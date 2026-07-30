import os

from dotenv import load_dotenv
from pymongo import MongoClient

# Read the secrets from pipeline/.env into the program.
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/")
MONGO_DB = os.getenv("MONGO_DB", "papertrail")

# One shared connection to MongoDB for the whole pipeline.
client = MongoClient(MONGO_URL)
db = client[MONGO_DB]

# A "collection" is like a table/folder-box. Ours holds page snapshots.
snapshots = db["snapshots"]