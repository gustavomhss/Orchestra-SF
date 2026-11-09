# Settings

Settings is at `/orchestra/settings`. It has a section list on the left and one section on the right. `?section=<id>` opens a section directly.

## With no project open

Only server-wide sections are listed: **General**, **Shortcuts**, **Servers** and **Trusted projects**. Project sections (Providers, Models, Permissions, Agents and MCP) are hidden instead of showing "Open a project", because they change one project's configuration. Open a project to reach them.

For the look of the app (theme, background and fonts) see [Appearance](appearance.md). For changing keys see [Shortcuts](shortcuts.md).

## General

For the switches, shell, notifications and desktop-only controls, see [General settings](settings-advanced.md).

## Servers

Servers are Orchestra server connections, not model providers or MCP servers.

- Use **Add server** to save a connection. Enter its **Server address**, an optional name, and a username and password if the server requires them. The dialog checks the connection and shows an error if it cannot connect.
- When more than one server is listed, search by name or address. A row shows its health, version when available, and username.
- A saved HTTP connection's row menu offers **Edit** and **Delete**. Built-in connections cannot be edited or deleted there. **Delete** asks for confirmation: it removes the saved connection, its password and its open tabs from this app. It does not delete the remote server's projects or sessions.
- Where choosing a default is supported, use **Set as default** or **Remove default** in the row menu; a **Default** tag marks the selected connection. Server availability depends on the app and platform; a saved address does not start a remote Orchestra server for you.

Saving a connection does not secure the remote listener. The Orchestra CLI server uses its saved service password unless a nonempty `ORCHESTRA_SERVER_PASSWORD` overrides it. A network listener using plain HTTP sends that password and your traffic without encryption: use a trusted network or terminate HTTPS at a trusted proxy. Browser-origin/CORS checks are not authentication.

### Listener hostnames

The `serve` and `web` listeners accept `localhost`, `127.0.0.1`, `[::1]`, the bind hostname, and local IPv4/IPv6 interface addresses captured once at startup, without DNS lookups. IPv6 addresses use brackets; discovered addresses containing a zone identifier are omitted. Binding to `0.0.0.0` or `::` does not allow arbitrary HTTP Host values.

For a reverse proxy or another hostname, repeat `--allowed-host` (up to 100 explicit values). Use hostnames, not full URLs, and brackets for IPv6. Invalid explicit values fail startup visibly.

```sh
orchestra serve --hostname 0.0.0.0 \
  --allowed-host proxy.example.test \
  --allowed-host orchestra.example.test

orchestra web --allowed-host proxy.example.test
```

With `web --mdns`, the `--mdns-domain` value is also allowed. Supplying `--mdns-domain` without enabling mDNS does not add that name.

Admission checks the actual HTTP `Host` header received by the listener. `Forwarded` and `X-Forwarded-Host` do not authorize a different Host. Configure the proxy's upstream Host accordingly. Unknown or malformed Host values receive HTTP **421 Misdirected Request**. An allowed Host still requires the usual authentication on protected API routes; CORS remains a separate policy.

The host comparison ignores port, letter case and a final dot. Restart the listener to refresh its interface-address snapshot.

Saving or editing a connection in Settings does not configure the remote listener's bind address, allowed hosts or authentication. Configure these on the machine running that server.

## Shortcuts

**Reset to defaults** asks you to confirm, because it drops every shortcut you changed at once.

## With a project open

All sections are listed. The project sections apply to the server or to the project, and the page says which where that matters.

## Providers

Open a project, then choose **Providers**. The scope note names the Orchestra server affected by provider and model changes; this is not a separate set of secrets for every open tab.

1. Choose **Connect provider**, then a provider. Follow the authentication method offered by that provider, such as an API key or sign-in. Not every provider offers the same methods.
2. A connected card shows its connection status and how it is configured. **Configure** reopens that provider's connection flow. Use its models action, or the **Models** section, to choose what appears in the composer.
3. **Disconnect** asks for confirmation. Environment- or config-managed connections may not be removable from this screen; change their source instead. A failed catalog load offers a retry rather than a successful connection status.

For credential storage and recovery, see [Stored credentials](credentials.md). For Claude subscription sign-in, see [Claude mode](claude-mode.md); it is not an API key stored by Orchestra. See [Models and engines](models.md) for model routing.

## Models

Open a project, then choose **Models**. **Search models** filters by model name, model ID or provider name. Each row shows its provider and context size when known.

- The model's switch controls whether it appears in the composer; it does not disconnect the provider.
- **Set as default** is offered for a visible model when the server is ready to save. It saves the server-wide default model used for new turns; it is not a command to replace a request already running. The chosen row shows **Default**. A failed save restores the previous selection and shows an error.
- If there are no models after loading, **Connect provider** takes you to Providers. A model list still loading is not evidence that no models are available.

## Permissions

This section controls server-wide default tool rules; project and agent rules can override them. A row locked by config patterns or by a later rule must be changed in that config file. Saved permission decisions are separate from the default rules. See [Permissions](permissions.md) for their scopes and the request controls.

## Agents

Settings shows the open project's agent roster, with each agent's role, description, model and step limit when supplied. **Configure** and **Create agent** open the Agents page; editing the agent's prompt, tools, skills or picture happens there, not in the Settings card.

Only Maestro's card offers **Open Chat**; specialists work through Maestro. For saving, resetting and removing agent configuration, see [The agent screen](agent-screen.md). [The agents](agents.md) explains the seats' roles. Maestro's name stays fixed; other seats keep their stable IDs when you change their display names.

## Trusted projects

This section lists the project folders the global config trusts. A trusted project's own local MCP servers, plugins and formatters run. **Revoke** removes that folder from the list and stops its running local MCP servers. Trust is granted from the project's MCP page, or by editing `trusted_projects` in your global config. See [Project trust](mcp-project-trust.md) for what trust covers.

Revoking a folder that is trusted only through a parent folder changes nothing for that folder. Revoke the parent instead.

## MCP servers

Settings lists the open project's MCP servers and their status and lets you enable or disable them. **Configure** opens the MCP page, where editing and tool inspection live. On that page:

- **Add MCP server**: type a command to run a local server, or a URL to connect to a remote one. The transport follows what you type, so there is no transport choice. A local server takes environment variables as `KEY=value` lines. A remote server takes headers as `Name: value` lines.
- Values you enter replace the set of the same kind in the config file. Leave the box empty to keep what the file has. Secrets and OAuth clients are not shown on the page. Add an OAuth client to `orchestra.json` by hand.
- **Try again** retries a server that failed to start. Its error is shown on the card.
- A local server from a project that is not trusted shows a banner with **Trust this project**.
