"""Execute a project Blender script through an installed Blender MCP server.

Requires the Python MCP SDK (``python -m pip install mcp``), a Blender MCP
server executable, and its running Blender bridge. The default server command
is ``blender-mcp`` on PATH; override with --server or BLENDER_MCP_COMMAND.
"""
import argparse
import asyncio
import os
import shutil
from pathlib import Path


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('script', nargs='?', type=Path,
                        help='Blender Python script; omit for a connection smoke check')
    parser.add_argument('--server', default=os.environ.get('BLENDER_MCP_COMMAND', 'blender-mcp'),
                        help='MCP server executable path or command (default: BLENDER_MCP_COMMAND or blender-mcp)')
    args = parser.parse_args()
    server = shutil.which(os.path.expanduser(args.server))
    if not server:
        parser.error('Blender MCP server executable was not found. Install your Blender MCP server '
                     'and put blender-mcp on PATH, or pass --server /path/to/blender-mcp '
                     '(also configurable with BLENDER_MCP_COMMAND). Start its Blender bridge before running this client.')
    if args.script:
        script = args.script.expanduser().resolve()
        try:
            code = '__file__ = ' + repr(str(script)) + '\n' + script.read_text(encoding='utf-8')
        except (OSError, UnicodeError) as error:
            parser.error(f'Cannot read Blender script {script}: {error}')
    else:
        code = "import bpy\nresult = {'version': bpy.app.version_string, 'objects': len(bpy.data.objects)}"
    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError:
        parser.error('The Python MCP SDK is missing from this environment. Install it with: python -m pip install mcp')
    async with stdio_client(StdioServerParameters(command=server, args=[])) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            reply = await session.call_tool('execute_blender_code', {'code': code})
            print(reply.model_dump_json())
            return 1 if reply.isError else 0


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
