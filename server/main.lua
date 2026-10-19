local RESOURCE = GetCurrentResourceName()

local ESX
if GetResourceState('es_extended') ~= 'missing' then
    local ok, obj = pcall(function() return exports.es_extended:getSharedObject() end)
    if ok then ESX = obj end
end

local allowedGroups = {}
for _, group in ipairs(ServerConfig.Groups or {}) do allowedGroups[group] = true end

local MODES = {
    cl_server = true, cl_event = true, cl_command = true, cl_export = true, cl_callback = true,
    sv_event = true, sv_client = true, sv_command = true, sv_export = true, sv_callback = true,
}

local rate = {}
local watchers = {}
local viewers = {}
local saved = {}
local savedSeq = 0

local function allowed(src)
    if ServerConfig.Ace and IsPlayerAceAllowed(src, ServerConfig.Ace) then return true end
    if not ESX then return false end
    local xPlayer = ESX.GetPlayerFromId(src)
    return xPlayer ~= nil and allowedGroups[xPlayer.getGroup()] == true
end

local function limited(src)
    local now = GetGameTimer()
    local r = rate[src]
    if not r or now - r.start > ServerConfig.RateLimit.window then
        rate[src] = { start = now, count = 1 }
        return false
    end
    r.count = r.count + 1
    return r.count > ServerConfig.RateLimit.max
end

local function log(src, action, name, args)
    local player = ('%s (%d)'):format(GetPlayerName(src) or 'unknown', src)
    if ServerConfig.LogToConsole then
        print(('^3[executor]^7 %s %s %s %s'):format(player, action, name, args or ''))
    end
    if ServerConfig.Webhook and ServerConfig.Webhook ~= '' then
        PerformHttpRequest(ServerConfig.Webhook, function() end, 'POST', json.encode({
            username = 'Executor',
            embeds = { {
                title = action,
                color = 3289650,
                fields = {
                    { name = 'Player', value = player, inline = true },
                    { name = 'Name', value = ('`%s`'):format(name:sub(1, 200)), inline = true },
                    { name = 'Args', value = ('```%s```'):format((args or '-'):sub(1, 900)) },
                },
                timestamp = os.date('!%Y-%m-%dT%H:%M:%SZ'),
            } },
        }), { ['Content-Type'] = 'application/json' })
    end
    if ServerConfig.CustomLog then
        pcall(ServerConfig.CustomLog, src, action, name, args)
    end
end

local function playerList()
    local list = {}
    for _, id in ipairs(GetPlayers()) do
        list[#list + 1] = { id = tonumber(id), name = GetPlayerName(id) or '?' }
    end
    table.sort(list, function(a, b) return a.id < b.id end)
    return list
end

local function loadSaved()
    local raw = LoadResourceFile(RESOURCE, ServerConfig.SavedFile)
    if not raw or raw == '' then return end
    local ok, data = pcall(json.decode, raw)
    if not ok or type(data) ~= 'table' then return end
    for _, entry in ipairs(data) do
        if type(entry) == 'table' and type(entry.id) == 'string' and type(entry.line) == 'string' then
            saved[#saved + 1] = entry
        end
    end
end

local function persist()
    SaveResourceFile(RESOURCE, ServerConfig.SavedFile, json.encode(saved), -1)
end

local function broadcastSaved()
    for src in pairs(viewers) do
        if GetPlayerName(src) then
            TriggerClientEvent('executor:saved', src, saved)
        else
            viewers[src] = nil
        end
    end
end

local function validLabel(name)
    return type(name) == 'string' and #name > 0 and #name <= 60 and not name:find('%c')
end

loadSaved()

RegisterNetEvent('executor:open', function()
    local src = source
    if not allowed(src) or limited(src) then return end
    viewers[src] = true
    TriggerClientEvent('executor:open', src, { players = playerList(), me = src, saved = saved })
end)

RegisterNetEvent('executor:players', function()
    local src = source
    if not allowed(src) or limited(src) then return end
    TriggerClientEvent('executor:players', src, playerList())
end)

RegisterNetEvent('executor:save', function(entry)
    local src = source
    if not allowed(src) or limited(src) or type(entry) ~= 'table' then return end
    local line, side, mode = entry.line, entry.side, entry.mode
    if type(line) ~= 'string' or #line < 1 or #line > 2000 then return end
    if side ~= 'client' and side ~= 'server' then return end
    if mode ~= nil and not MODES[mode] then return end
    local name = validLabel(entry.name) and entry.name or line:sub(1, 60)
    if #saved >= ServerConfig.MaxSaved then table.remove(saved) end
    savedSeq = savedSeq + 1
    table.insert(saved, 1, {
        id = ('%d%03d'):format(os.time(), savedSeq % 1000),
        name = name,
        line = line,
        side = side,
        mode = mode,
        target = math.tointeger(tonumber(entry.target)),
        by = GetPlayerName(src) or '?',
        at = os.time(),
    })
    persist()
    broadcastSaved()
end)

RegisterNetEvent('executor:rename', function(id, name)
    local src = source
    if not allowed(src) or limited(src) or type(id) ~= 'string' or not validLabel(name) then return end
    for _, entry in ipairs(saved) do
        if entry.id == id then
            entry.name = name
            persist()
            broadcastSaved()
            return
        end
    end
end)

RegisterNetEvent('executor:unsave', function(id)
    local src = source
    if not allowed(src) or limited(src) or type(id) ~= 'string' then return end
    for i, entry in ipairs(saved) do
        if entry.id == id then
            table.remove(saved, i)
            persist()
            broadcastSaved()
            return
        end
    end
end)

local function unwatch(name, src)
    local w = watchers[name]
    if not w then return end
    w.subs[src] = nil
    if next(w.subs) == nil then
        RemoveEventHandler(w.handle)
        watchers[name] = nil
    end
end

local function getTarget(value)
    local target = math.tointeger(tonumber(value))
    if target == -1 then return target end
    if not target or not GetPlayerName(target) then return nil end
    return target
end

local actions = {}

actions.sv_event = function(_, name, list, n)
    TriggerEvent(name, table.unpack(list, 1, n))
    return true, 'triggered'
end

actions.sv_client = function(_, name, list, n, data)
    local target = getTarget(data.target)
    if not target then return false, ('player %s is not online'):format(tostring(data.target)) end
    TriggerClientEvent(name, target, table.unpack(list, 1, n))
    return true, target == -1 and 'sent to all players' or ('sent to player %d'):format(target)
end

actions.sv_command = function(_, name)
    ExecuteCommand(name)
    return true, 'executed'
end

actions.sv_export = function(_, name, list, n, data)
    return Codec.callExport(data.resource, name, list, n)
end

actions.sv_callback = function(_, name, list, n, data)
    local target = getTarget(data.target)
    if not target or target == -1 then return false, ('player %s is not online'):format(tostring(data.target)) end
    local res = Codec.race(Config.CallbackTimeout, lib.callback.await, name, target, table.unpack(list, 1, n))
    if not res[1] then return false, tostring(res[2]) end
    return true, Codec.encode({ table.unpack(res, 2, res.n) }, res.n - 1)
end

actions.sv_watch = function(src, name)
    local w = watchers[name]
    if not w then
        w = { subs = {} }
        w.handle = AddEventHandler(name, function(...)
            local packed = table.pack(...)
            local payload = Codec.encode(packed, packed.n)
            local from = source
            for sub in pairs(w.subs) do
                TriggerClientEvent('executor:caught', sub, 'server', name, payload, from)
            end
        end)
        watchers[name] = w
    end
    w.subs[src] = true
    return true, 'watching'
end

actions.sv_unwatch = function(src, name)
    unwatch(name, src)
    return true, 'stopped watching'
end

RegisterNetEvent('executor:run', function(id, mode, name, args, n, data)
    local src = source
    if not allowed(src) or type(id) ~= 'number' then return end
    local function reply(ok, value) TriggerClientEvent('executor:result', src, id, ok, value) end
    if limited(src) then return reply(false, 'rate limited, slow down') end
    if type(mode) ~= 'string' or not actions[mode] then return reply(false, 'unknown action') end
    if not Codec.validName(name) then return reply(false, 'invalid name') end
    local list, count = Codec.readArgs(args, n)
    if not list then return reply(false, 'invalid arguments') end
    data = type(data) == 'table' and data or {}
    list = Codec.args(list, count, src)
    if mode ~= 'sv_unwatch' then log(src, mode, name, count > 0 and Codec.encode(list, count) or nil) end
    local ok, success, value = pcall(actions[mode], src, name, list, count, data)
    if not ok then return reply(false, tostring(success)) end
    reply(success == true, value)
end)

RegisterNetEvent('executor:log', function(mode, name, args)
    local src = source
    if not allowed(src) or limited(src) then return end
    if type(mode) ~= 'string' or not MODES[mode] or not Codec.validName(name) then return end
    log(src, mode, name, type(args) == 'string' and args:sub(1, 1500) or nil)
end)

AddEventHandler('playerDropped', function()
    local src = source
    rate[src] = nil
    viewers[src] = nil
    for name in pairs(watchers) do unwatch(name, src) end
end)
