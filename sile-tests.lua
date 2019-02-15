package.path = '?.lua;/usr/local/share/sile/?.lua;/usr/local/share/sile/lua-libraries/?.lua;/usr/local/share/sile/lua-libraries/?/init.lua;lua-libraries/?.lua;lua-libraries/?/init.lua;' .. package.path
local pathvar = os.getenv("SILE_PATH")
if pathvar then
    for path in string.gmatch(pathvar, "[^;]+") do
        package.path =  path .. "/?.lua;" .. package.path
    end
end
package.cpath = package.cpath .. ";core/?.so;/usr/local/lib/sile/?.so;"
testingSILE = true
SILE = require("core/sile")
SILE.documentState = { documentClass = { state = { } } }
SILE.typesetter:init(SILE.newFrame({id="foo"}))

local hlist = {}
local function nnode(spec) table.insert(hlist, SILE.nodefactory.newNnode(spec)) end
local function glue(spec) table.insert(hlist, SILE.nodefactory.newGlue(spec)) end

nnode({ text = "123456", width = 6 })
glue({ width = SILE.length.new({ length = 1, stretch = 1, shrink = 0 }) })
nnode({ text = "789", width = 3 })
glue({ width = SILE.length.new({ length = 1, stretch = 1, shrink = 0 }) })
nnode({ text = "012", width = 3 })
glue({ width = SILE.length.new({ length = 0, stretch = 1000, shrink = 0 }) })

for i = 1,#hlist do print(i, hlist[i]) end
-- SILE.debugFlags["break"] = true
print(SILE.linebreak:doBreak(hlist, 10))
