import os
import uvicorn
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.repository import init_db
from app.api.routes import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("🚀 Palfin Python server started")
    yield
    logger.info("👋 Palfin Python server shutting down")

app = FastAPI(
    title="Palfin API",
    description="Financial coaching backend with ML transaction classification",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
