from hashlib import sha256
import json
from pathlib import Path
import re
from struct import unpack_from
import sys
import tarfile


def digest(data):
    return sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_modules(binary):
    def reader(fmt, offset):
        return unpack_from("<" + fmt, binary, offset)

    require(binary[:6] == b"\x7fELF\x02\x01" and reader("H", 18) == (62,), "Expected x86-64 ELF")
    table, = reader("Q", 40)
    entry_size, count, names_index = reader("HHH", 58)
    require(entry_size == 64 and 0 < names_index < count and table + 64 * count <= len(binary),
            "Invalid ELF section table")
    names_offset, names_size = reader("QQ", table + 64 * names_index + 24)
    require(0 < names_size <= len(binary) - names_offset, "Invalid ELF section names")
    names = binary[names_offset:names_offset + names_size]
    sections = []
    for offset in range(table, table + 64 * count, 64):
        name, kind = reader("II", offset)
        if names[name:name + 5] == b".bun\x00":
            require(kind == 1, "Invalid .bun section kind")
            sections.append(reader("QQ", offset + 24))
    require(len(sections) == 1, "Expected one .bun section")
    section, length = sections[0]
    start = section + 8
    require(start + 47 <= section + length <= len(binary) and reader("Q", section) == (length - 8,),
            "Invalid .bun section extent")
    trailer = b"\n---- Bun! ----\n"
    section_end = section + length
    require(binary[section_end - len(trailer):section_end] == trailer, "Invalid Bun graph trailer")
    footer = section_end - len(trailer) - 32
    byte_count, module_offset, module_size, entry = reader("QIII", footer)
    row_count = module_size // 52
    first_row = start + module_offset
    require(byte_count == footer - start and 0 < row_count and module_size % 52 == 0
            and first_row + module_size <= footer and entry < row_count, "Invalid Bun module table")
    modules = {}
    pointers = {}
    protected = []
    for row in range(first_row, first_row + module_size, 52):
        name_offset, name_length, body_offset, body_length, map_offset, map_length = reader("IIIIII", row)
        require(map_offset == 0 and map_length == 0, "Packaged module still has a sourcemap pointer")
        require(0 < name_length and name_offset + name_length < module_offset, "Invalid module name extent")
        name_end = start + name_offset + name_length
        require(binary[name_end] == 0, "Module name has no terminator")
        name = binary[start + name_offset:name_end].decode("utf8")
        encoding, loader = reader("BB", row + 48)
        terminator = 2 if encoding == 2 else 1
        end = start + body_offset + body_length
        require(encoding <= 2 and end + terminator <= first_row
                and (encoding != 2 or (body_offset | body_length) % 2 == 0)
                and binary[end:end + terminator] == bytes(terminator), "Invalid module body extent or terminator")
        require(name.startswith("/$bunfs/root/") and name not in modules, "Invalid or duplicated module name")
        offset = start + body_offset
        modules[name] = (offset, body_length, encoding, loader, digest(memoryview(binary)[offset:end]))
        pointers[name] = (row + 16, row + 24)
        protected.extend(((start + name_offset, name_end + 1), (offset, end + terminator)))
        for field, terminates in ((24, False), (32, False), (40, True)):
            reserved_offset, reserved_length = reader("II", row + field)
            if reserved_length:
                lo = start + reserved_offset
                hi = lo + reserved_length + int(terminates)
                require(start <= lo < hi <= first_row, "Invalid protected range in the module")
                protected.append((lo, hi))
    return modules, pointers, protected, (start, first_row)


def main(archive, maps):
    index = json.loads((maps / "index.json").read_bytes())
    require(index["schema"] == "orchestra-linux-compile-source-maps-v1", "Unexpected map index schema")
    with tarfile.open(archive, "r:gz") as payload:
        members = payload.getmembers()
        require(not any(member.name.endswith(".map") for member in members), "Source map shipped in distribution")
        executables = [member for member in members if member.name == "bin/orchestra"]
        require(len(executables) == 1 and executables[0].isreg(), "Expected exactly one regular packed CLI")
        binary = payload.extractfile(executables[0]).read()
    require(digest(binary) == index["binarySha256"], "Source map index belongs to another executable")
    prior_end = 0
    for region in index["scrubbedRanges"]:
        start, end = region["start"], region["end"]
        require(prior_end <= start < end <= len(binary) and not any(binary[start:end]), "Invalid or unredacted debug range")
        prior_end = end
    physical, pointers, protected, (graph_start, table_start) = read_modules(binary)
    expected_ranges = set()
    names = set()
    mapped = set()
    for module in index["modules"]:
        name = module["name"]
        expected = tuple(module[key] for key in ("offset", "byteLength", "encoding", "loader", "sha256"))
        require(name not in names and physical.get(name) == expected, f"Packaged module index differs for {name}")
        names.add(name)
        if module["status"] == "no-compiler-map":
            continue
        map_name = module["map"]
        require(module["status"] == "matched-compiler-map" and isinstance(module["coordinates"], int)
                and module["coordinates"] >= 0 and map_name not in mapped
                and re.fullmatch(r"[A-Za-z0-9_.-]+\.map", map_name), "Invalid compiler map record")
        embedded = module["embeddedMap"]
        begin = embedded["offset"]
        end = begin + embedded["byteLength"]
        require(graph_start <= begin < end <= table_start, f"Scrubbed map payload leaves graph data for {name}")
        require(all(end <= lo or begin >= hi for lo, hi in protected), f"Scrubbed map overlaps protected bytes for {name}")
        expected_ranges.update(((begin, end), pointers[name]))
        mapped.add(map_name)
        data = (maps / map_name).read_bytes()
        require(digest(data) == module["mapSha256"], f"Published source map bytes differ for {map_name}")
        content = json.loads(data)
        require(set(content) == {"version", "sources", "names", "mappings"}
                and content["version"] == 3
                and content["sources"] == [source["source"] for source in module["sources"]],
                f"Public map has unexpected fields or sources: {map_name}")
    require(expected_ranges == {(item["start"], item["end"]) for item in index["scrubbedRanges"]}
            and len(expected_ranges) == 2 * len(mapped), "Declared scrub ranges differ from the matched modules")
    require(names == physical.keys(), "Map index omits a packaged module")
    require(mapped and len(mapped) == index["detachedMapCount"]
            and {item.name for item in maps.iterdir()} == mapped | {"index.json"},
            "Map index and public map members differ")
    print(json.dumps({"status": "pass", "packagedModules": len(names), "compilerMaps": len(mapped)}))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
