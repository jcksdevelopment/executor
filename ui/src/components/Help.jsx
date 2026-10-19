const TEXT = `CALLS
  TriggerServerEvent('esx:useItem', 'bread')        client -> server, source is you
  TriggerEvent('event', 1, 2)                       local event on the selected side
  TriggerClientEvent('event', -1, 'hello')          server -> player id or -1 for everyone
  ExecuteCommand('ensure ox_inventory')             command on the selected side
  /e sit                                            same as ExecuteCommand
  exports.ox_inventory:Search('count', 'water')     export call, prints the return value
  lib.callback.await('name', false, ...)            ox_lib callback (client side)
  lib.callback.await('name', 4, ...)                ox_lib callback to player 4 (server side)

SHORT FORM
  esx:playerLoaded                                  name only, uses the type selected below
  esx:showNotification 'hello', 5                   name followed by arguments
  ox_inventory:Search 'count', 'water'              export as resource:function

VALUES
  'text'  "text"  [[multi line]]
  5  -2.5  0xFF  true  false  nil
  {1, 2, 3}  {name = 'lspd', grade = 2}  {"json": true}
  vector3(1.0, 2.0, 3.0)  vec4(...)                 sent as real vectors
  source  me  GetPlayerServerId(PlayerId())         your server id
  PlayerPedId()  cache.ped                          your ped
  GetEntityCoords(PlayerPedId())  cache.coords      your coords
  cache.vehicle                                     your current vehicle

CONSOLE COMMANDS
  help                     this page
  clear                    clear the console
  players                  list online players
  save [name]              save the last call
  watch <event> [server]   print every time the event fires
  unwatch <event> [server]

KEYS
  Enter        run
  Up / Down    history
  Tab          accept suggestion
  Ctrl+L       clear
  Esc          close`;

export default function Help() {
    return (
        <div className="h-full overflow-y-auto">
            <pre className="p-4 font-mono text-[12.5px] leading-5 text-fg select-text">{TEXT}</pre>
        </div>
    );
}
