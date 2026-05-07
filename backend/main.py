from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, menu, sessions, orders, analytics, notes
from sockets import sio
import socketio
import models
from database import engine

models.Base.metadata.create_all(bind=engine)

fastapi_app = FastAPI(title="Restaurant System API")

# Configure CORS
origins = ["*"]
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
fastapi_app.include_router(auth.router)
fastapi_app.include_router(menu.router)
fastapi_app.include_router(sessions.router)
fastapi_app.include_router(orders.router)
fastapi_app.include_router(analytics.router)
fastapi_app.include_router(notes.router)

@fastapi_app.get("/")
def root():
    return {"message": "Welcome to the Restaurant System API"}

# Wrap with ASGI application
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
