fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'executor'
description 'In-game console for testing events, commands, exports and callbacks'
version '1.0.0'

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
    'shared/codec.lua',
}

server_scripts {
    'config.server.lua',
    'server/main.lua',
}

client_script 'client/main.lua'

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/assets/*.js',
    'web/assets/*.css',
}

dependency 'ox_lib'
