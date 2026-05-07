import models
from database import engine, SessionLocal
from utils import get_password_hash

def init():
    # Create all tables
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Check if we have users, if not create default ones
    if not db.query(models.User).first():
        print("Creating default users...")
        users = [
            models.User(username="owner", password_hash=get_password_hash("owner123"), role="owner"),
            models.User(username="waiter", password_hash=get_password_hash("waiter123"), role="waiter"),
            models.User(username="kitchen", password_hash=get_password_hash("kitchen123"), role="kitchen", pin="1234"),
        ]
        db.add_all(users)
        db.commit()

    # Create 20 tables if none exist
    if not db.query(models.Table).first():
        print("Creating 20 tables...")
        tables = [models.Table(table_number=i) for i in range(1, 21)]
        db.add_all(tables)
        db.commit()
        
    # Create some dummy menu items if none exist
    if not db.query(models.MenuItem).first():
        print("Creating default menu items...")
        items = [
            models.MenuItem(name="Margherita Pizza", description="Classic tomato and cheese", price=12.99, category="Mains"),
            models.MenuItem(name="Garlic Bread", description="Toasted bread with garlic butter", price=4.99, category="Starters"),
            models.MenuItem(name="Cola", description="Refreshing soda", price=2.50, category="Drinks"),
            models.MenuItem(name="Tiramisu", description="Coffee flavored Italian dessert", price=6.50, category="Desserts"),
        ]
        db.add_all(items)
        db.commit()
        
    db.close()
    print("Database initialized successfully!")

if __name__ == "__main__":
    init()
