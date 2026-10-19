# executor

In-game console for FiveM that lets you fire events, commands, exports and ox_lib callbacks while developing or testing a server. Write a line the way you would in Lua and it runs on the client or the server.

```lua
TriggerServerEvent('esx:useItem', 'bread')
TriggerClientEvent('esx:showNotification', -1, 'Restart in 5 minutes')
exports.ox_inventory:Search('count', 'water')
lib.callback.await('ox_inventory:getItemCount', false, 'water')
```

> This is a development tool. Only give access to people you trust, and do not leave it running on a public server longer than you need it.

## Features

- Full Lua-like calls or just an event name, with optional arguments
- Client and server side: `TriggerEvent`, `TriggerServerEvent`, `TriggerClientEvent`, `ExecuteCommand`, exports and ox_lib callbacks
- Return values from exports and callbacks are printed
- Arguments support strings, numbers, booleans, `nil`, Lua and JSON tables, `vector2/3/4`, `source`, `PlayerPedId()`, `GetEntityCoords(PlayerPedId())` and `cache.*`
- Event watcher for client and server events (prints arguments and sender)
- Saved triggers, stored in `data/saved.json` inside the resource and shared between everyone with access
- Command history with Up/Down and inline suggestions
- Access via ESX groups or an ACE permission, checked on the server for every action
- Rate limiting and logging to the console, a Discord webhook or your own logger

## Requirements

- [ox_lib](https://github.com/overextended/ox_lib)
- [es_extended](https://github.com/esx-framework/esx_core) is optional, only used for group checks

## Installation

1. Download the latest release, or clone the repository and build the UI (see below).
2. Put the `executor` folder in your `resources` directory.
3. Add `ensure executor` to your `server.cfg` after `ox_lib`.
4. Configure access in `config.server.lua`, for example:

```cfg
add_ace group.admin executor.use allow
```

5. Use `/executor` in game.

## Configuration

| File | Option | Description |
| --- | --- | --- |
| `config.lua` | `Command` | Command that opens the executor |
| | `CallbackTimeout` | How long to wait for an ox_lib callback (ms) |
| | `MaxArgs` | Maximum arguments per call |
| `config.server.lua` | `Groups` | ESX groups with access |
| | `Ace` | ACE permission with access, `false` to disable |
| | `RateLimit` | Actions allowed per player per window |
| | `SavedFile` | Where saved triggers are stored |
| | `MaxSaved` | Maximum saved triggers |
| | `LogToConsole` | Print actions to the server console |
| | `Webhook` | Discord webhook for action logs |
| | `CustomLog` | Your own logger, `function(source, action, name, args)` |

## Console commands

| Command | Description |
| --- | --- |
| `help` | Syntax reference |
| `clear` | Clear the console |
| `players` | List online players |
| `save [name]` | Save the last call |
| `watch <event> [server]` | Print the event every time it fires |
| `unwatch <event> [server]` | Stop watching |

## Building the UI

The compiled UI is in `web/`. To change it:

```sh
cd ui
npm install
npm run dev
npm run build
```

`npm run dev` opens the UI in a browser with mocked responses. `npm run build` writes the result to `web/`.

## License

[zlib](LICENSE). You can use and modify it however you want, but you must not claim you wrote the original, and modified versions must be marked as modified.
