local open = false
local watchers = {}
local nextId = 0

local function setOpen(state, payload)
    open = state
    SetNuiFocus(state, state)
    SendNUIMessage({ action = state and 'open' or 'close', data = payload })
end

local function sendResult(id, ok, value)
    SendNUIMessage({ action = 'result', id = id, ok = ok, value = value })
end

RegisterCommand(Config.Command, function()
    TriggerServerEvent('executor:open')
end, false)

RegisterNetEvent('executor:open', function(payload)
    setOpen(true, payload)
end)

RegisterNetEvent('executor:players', function(players)
    SendNUIMessage({ action = 'players', players = players })
end)

RegisterNetEvent('executor:saved', function(list)
    SendNUIMessage({ action = 'saved', saved = list })
end)

RegisterNetEvent('executor:result', sendResult)

RegisterNetEvent('executor:caught', function(side, name, payload, from)
    SendNUIMessage({ action = 'caught', side = side, name = name, args = payload, from = from })
end)

RegisterNUICallback('close', function(_, cb)
    setOpen(false)
    cb(1)
end)

RegisterNUICallback('players', function(_, cb)
    TriggerServerEvent('executor:players')
    cb(1)
end)

RegisterNUICallback('save', function(entry, cb)
    TriggerServerEvent('executor:save', entry)
    cb(1)
end)

RegisterNUICallback('rename', function(data, cb)
    if type(data) == 'table' then TriggerServerEvent('executor:rename', data.id, data.name) end
    cb(1)
end)

RegisterNUICallback('unsave', function(data, cb)
    if type(data) == 'table' then TriggerServerEvent('executor:unsave', data.id) end
    cb(1)
end)

local actions = {}

actions.cl_server = function(name, list, n)
    TriggerServerEvent(name, table.unpack(list, 1, n))
    return true, 'sent to server'
end

actions.cl_event = function(name, list, n)
    TriggerEvent(name, table.unpack(list, 1, n))
    return true, 'triggered'
end

actions.cl_command = function(name)
    ExecuteCommand(name)
    return true, 'executed'
end

actions.cl_export = function(name, list, n, data)
    return Codec.callExport(data.resource, name, list, n)
end

actions.cl_watch = function(name)
    if watchers[name] then return true, 'already watching' end
    watchers[name] = AddEventHandler(name, function(...)
        local packed = table.pack(...)
        SendNUIMessage({ action = 'caught', side = 'client', name = name, args = Codec.encode(packed, packed.n) })
    end)
    return true, 'watching'
end

actions.cl_unwatch = function(name)
    if watchers[name] then
        RemoveEventHandler(watchers[name])
        watchers[name] = nil
    end
    return true, 'stopped watching'
end

local LOGGED = { cl_server = true, cl_callback = true }

RegisterNUICallback('run', function(data, cb)
    if not open or type(data) ~= 'table' or type(data.mode) ~= 'string' then return cb({ ok = false, value = 'invalid request' }) end
    local name = data.name
    if not Codec.validName(name) then return cb({ ok = false, value = 'invalid name' }) end
    local list, n = Codec.readArgs(data.args, data.n)
    if not list then return cb({ ok = false, value = ('too many arguments (max %d)'):format(Config.MaxArgs) }) end
    local extra = type(data.data) == 'table' and data.data or {}
    local mode = data.mode

    if mode:sub(1, 3) == 'sv_' then
        nextId = nextId + 1
        TriggerServerEvent('executor:run', nextId, mode, name, list, n, extra)
        return cb({ pending = nextId })
    end

    list = Codec.args(list, n)
    if LOGGED[mode] then TriggerServerEvent('executor:log', mode, name, n > 0 and Codec.encode(list, n) or nil) end

    if mode == 'cl_callback' then
        nextId = nextId + 1
        local id = nextId
        cb({ pending = id })
        CreateThread(function()
            local res = Codec.race(Config.CallbackTimeout, lib.callback.await, name, false, table.unpack(list, 1, n))
            if not res[1] then return sendResult(id, false, tostring(res[2])) end
            sendResult(id, true, Codec.encode({ table.unpack(res, 2, res.n) }, res.n - 1))
        end)
        return
    end

    local fn = actions[mode]
    if not fn then return cb({ ok = false, value = 'unknown action' }) end
    local ok, success, value = pcall(fn, name, list, n, extra)
    if not ok then return cb({ ok = false, value = tostring(success) }) end
    cb({ ok = success == true, value = value })
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() and open then SetNuiFocus(false, false) end
end)
