Codec = {}

local IS_SERVER = IsDuplicityVersion()
local MAX_DEPTH = 8

local function decode(v, src, depth)
    if type(v) ~= 'table' or depth > MAX_DEPTH then return v end
    if v.__vec then
        local c = v.__vec
        if type(c) ~= 'table' then return nil end
        local x, y, z, w = tonumber(c[1]) or 0.0, tonumber(c[2]) or 0.0, tonumber(c[3]), tonumber(c[4])
        if w then return vector4(x, y, z or 0.0, w) end
        if z then return vector3(x, y, z) end
        return vector2(x, y)
    end
    if v.__ped then
        if IS_SERVER then return src and GetPlayerPed(src) or 0 end
        return PlayerPedId()
    end
    if v.__veh then
        if IS_SERVER then
            local ped = src and GetPlayerPed(src) or 0
            return ped ~= 0 and GetVehiclePedIsIn(ped, false) or 0
        end
        return GetVehiclePedIsIn(PlayerPedId(), false)
    end
    if v.__coords then
        local ped = IS_SERVER and (src and GetPlayerPed(src) or 0) or PlayerPedId()
        return ped ~= 0 and GetEntityCoords(ped) or vector3(0.0, 0.0, 0.0)
    end
    if v.__t then
        local out = {}
        if type(v.__t) ~= 'table' then return out end
        for _, pair in ipairs(v.__t) do
            if type(pair) == 'table' and pair[1] ~= nil then
                out[decode(pair[1], src, depth + 1)] = decode(pair[2], src, depth + 1)
            end
        end
        return out
    end
    local out = {}
    for k, val in pairs(v) do out[k] = decode(val, src, depth + 1) end
    return out
end

function Codec.args(list, n, src)
    local out = {}
    for i = 1, n do out[i] = decode(list[i], src, 0) end
    return out
end

local function isArray(t)
    local count = 0
    for k in pairs(t) do
        if type(k) ~= 'number' or k < 1 or k % 1 ~= 0 then return false end
        count = count + 1
    end
    return count == #t
end

local function plain(v, depth)
    local t = type(v)
    if t == 'nil' then return '<nil>' end
    if t == 'number' or t == 'string' or t == 'boolean' then return v end
    if t == 'vector2' then return ('vector2(%.3f, %.3f)'):format(v.x, v.y) end
    if t == 'vector3' then return ('vector3(%.3f, %.3f, %.3f)'):format(v.x, v.y, v.z) end
    if t == 'vector4' then return ('vector4(%.3f, %.3f, %.3f, %.3f)'):format(v.x, v.y, v.z, v.w) end
    if t == 'table' then
        if depth > MAX_DEPTH then return '<table>' end
        local out = {}
        if isArray(v) then
            for i = 1, #v do out[i] = plain(v[i], depth + 1) end
            return out
        end
        for k, val in pairs(v) do out[tostring(k)] = plain(val, depth + 1) end
        return out
    end
    return '<' .. t .. '>'
end

function Codec.encode(list, n)
    local out = {}
    for i = 1, n do out[i] = plain(list[i], 0) end
    local ok, res = pcall(json.encode, out)
    if ok then return res end
    local fallback = {}
    for i = 1, n do fallback[i] = tostring(list[i]) end
    return json.encode(fallback)
end

function Codec.validName(name)
    return type(name) == 'string' and #name > 0 and #name <= 160 and not name:find('%c')
end

function Codec.readArgs(args, n)
    if type(args) ~= 'table' then args = {} end
    n = math.tointeger(tonumber(n)) or 0
    if n < 0 or n > Config.MaxArgs then return nil end
    local ok, encoded = pcall(json.encode, args)
    if not ok or #encoded > 32768 then return nil end
    local list = {}
    for i = 1, n do list[i] = args[i] end
    return list, n
end

function Codec.race(timeout, fn, ...)
    local p = promise.new()
    local done = false
    local params = table.pack(...)
    CreateThread(function()
        local res = table.pack(pcall(fn, table.unpack(params, 1, params.n)))
        if done then return end
        done = true
        p:resolve(res)
    end)
    SetTimeout(timeout, function()
        if done then return end
        done = true
        p:resolve({ false, ('timed out after %ds'):format(math.floor(timeout / 1000)), n = 2 })
    end)
    return Citizen.Await(p)
end

function Codec.callExport(resource, name, list, n)
    if not Codec.validName(resource) then return false, 'invalid resource name' end
    if GetResourceState(resource) ~= 'started' then return false, ('resource %s is not started'):format(resource) end
    local proxy = exports[resource]
    local res = table.pack(pcall(function() return proxy[name](proxy, table.unpack(list, 1, n)) end))
    if not res[1] then return false, tostring(res[2]) end
    return true, Codec.encode({ table.unpack(res, 2, res.n) }, res.n - 1)
end
