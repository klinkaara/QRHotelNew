import socketio

# Create a Socket.IO server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

@sio.event
async def connect(sid, environ, auth):
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def join_role_room(sid, data):
    role = data.get('role')
    if role in ['waiter', 'owner', 'kitchen']:
        await sio.enter_room(sid, role)
        print(f"Client {sid} joined room {role}")

@sio.event
async def join_table_room(sid, data):
    table_id = data.get('table_id')
    if table_id:
        room_name = f"table_{table_id}"
        await sio.enter_room(sid, room_name)
        print(f"Client {sid} joined room {room_name}")
