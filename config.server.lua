ServerConfig = {}

-- ESX groups that can use the executor (ignored when es_extended is not running)
ServerConfig.Groups = { 'founder' }

-- ACE permission that also grants access, e.g. add_ace group.admin executor.use allow
-- Set to false to disable the ACE check
ServerConfig.Ace = 'executor.use'

-- Max actions per player inside the window (ms)
ServerConfig.RateLimit = { window = 5000, max = 30 }

-- Saved triggers are stored in this file inside the resource folder
ServerConfig.SavedFile = 'data/saved.json'

-- Maximum number of saved triggers
ServerConfig.MaxSaved = 300

-- Print every action to the server console
ServerConfig.LogToConsole = true

-- Discord webhook for action logs, leave empty to disable
ServerConfig.Webhook = ''

-- Optional custom logger, called for every action
-- function(source, action, name, args) end
ServerConfig.CustomLog = nil
