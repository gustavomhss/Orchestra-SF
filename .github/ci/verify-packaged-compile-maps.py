from hashlib import sha256
import json
from pathlib import Path
import re
import sys
import tarfile


def digest(data):
    return sha256(data).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main(archive, maps):
    index = json.loads((maps / "index.json").read_bytes())
    require(index["schema"] == "orchestra-linux-compile-source-maps-v1", "Unexpected map index schema")
    with tarfile.open(archive, "r:gz") as payload:
        require(not any(member.name.endswith(".map") for member in payload), "Source map shipped in distribution")
        binary = payload.extractfile("bin/orchestra").read()
    require(digest(binary) == index["binarySha256"], "Source map index belongs to another executable")
    prior_end = 0
    for region in index["scrubbedRanges"]:
        start, end = region["start"], region["end"]
        require(prior_end <= start < end <= len(binary) and not any(binary[start:end]), "Invalid or unredacted debug range")
        prior_end = end
    names = set()
    mapped = set()
    for module in index["modules"]:
        offset = module["offset"]
        end = offset + module["byteLength"]
        require(module["name"] not in names and 0 <= offset <= end <= len(binary), "Invalid module range")
        names.add(module["name"])
        require(digest(binary[offset:end]) == module["sha256"], f"Packaged module bytes differ for {module['name']}")
        if module["status"] == "no-compiler-map":
            continue
        map_name = module["map"]
        require(module["status"] == "matched-compiler-map" and isinstance(module["coordinates"], int)
                and module["coordinates"] >= 0 and map_name not in mapped
                and re.fullmatch(r"[A-Za-z0-9_.-]+\.map", map_name), "Invalid compiler map record")
        mapped.add(map_name)
        data = (maps / map_name).read_bytes()
        require(digest(data) == module["mapSha256"], f"Published source map bytes differ for {map_name}")
        content = json.loads(data)
        require(set(content) == {"version", "sources", "names", "mappings"}
                and content["version"] == 3
                and content["sources"] == [source["source"] for source in module["sources"]],
                f"Public map has unexpected fields or sources: {map_name}")
    require(mapped and len(mapped) == index["detachedMapCount"]
            and {item.name for item in maps.iterdir()} == mapped | {"index.json"},
            "Map index and public map members differ")
    print(json.dumps({"status": "pass", "packagedModules": len(names), "compilerMaps": len(mapped)}))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
