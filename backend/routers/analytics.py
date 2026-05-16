from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
import models, database
from routers.auth import get_current_user
from sqlalchemy import func

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/dashboard")
def get_dashboard_summary(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can view analytics")
        
    today = date.today()
    start_of_today = datetime.combine(today, datetime.min.time())
    
    # Get all closed sessions from today
    today_sessions = db.query(models.Session).filter(
        models.Session.status == "Closed",
        models.Session.end_time >= start_of_today
    ).all()
    
    today_revenue = 0
    today_orders_count = 0
    for session in today_sessions:
        for order in session.orders:
            if order.status != "Pending":
                today_revenue += order.total_amount
                today_orders_count += 1
                
    # Get total active menu items
    active_menu_items = db.query(models.MenuItem).filter(models.MenuItem.is_active == True).count()
    
    # Get total active tables right now
    active_tables = db.query(models.Table).filter(models.Table.status != "Available").count()

    return {
        "today_revenue": today_revenue,
        "today_orders": today_orders_count,
        "active_menu_items": active_menu_items,
        "active_tables": active_tables
    }

def get_date_range(filter: Optional[str], date_str: Optional[str], start_date_str: Optional[str], end_date_str: Optional[str]):
    today = date.today()
    if filter == 'today':
        target = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else today
        return datetime.combine(target, datetime.min.time()), datetime.combine(target, datetime.max.time())
    elif filter == 'yesterday':
        target = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else today - timedelta(days=1)
        return datetime.combine(target, datetime.min.time()), datetime.combine(target, datetime.max.time())
    elif filter in ['week', 'month', 'custom']:
        if start_date_str and end_date_str:
            start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            return datetime.combine(start, datetime.min.time()), datetime.combine(end, datetime.max.time())
    
    # Default fallback
    return datetime.combine(today, datetime.min.time()), datetime.combine(today, datetime.max.time())

@router.get("/summary")
def get_analytics_summary(
    filter: Optional[str] = None,
    date_str: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can view analytics")
        
    start_dt, end_dt = get_date_range(filter, date or date_str, start_date, end_date)
    
    sessions = db.query(models.Session).filter(
        models.Session.start_time >= start_dt,
        models.Session.start_time <= end_dt
    ).all()
    
    period_revenue = 0
    period_orders_count = 0
    for session in sessions:
        for order in session.orders:
            if order.status != "Pending":
                period_revenue += order.total_amount
                period_orders_count += 1
                
    active_tables = db.query(models.Table).filter(models.Table.status != "Available").count()

    return {
        "today_revenue": period_revenue,
        "total_revenue": period_revenue,
        "today_orders": period_orders_count,
        "total_orders": period_orders_count,
        "active_tables": active_tables
    }

@router.get("/historical")
def get_historical_data(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can view analytics")
    
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    
    recent_orders = db.query(models.Order).filter(
        models.Order.created_at >= six_months_ago,
        models.Order.status != "Pending"
    ).all()
    
    monthly_data = {}
    
    for order in recent_orders:
        month_key = order.created_at.strftime("%Y-%m")
        month_label = order.created_at.strftime("%b %Y")
        
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                "label": month_label,
                "revenue": 0,
                "orders_count": 0,
                "sort_key": month_key
            }
            
        monthly_data[month_key]["revenue"] += order.total_amount
        monthly_data[month_key]["orders_count"] += 1
        
    result = list(monthly_data.values())
    result.sort(key=lambda x: x["sort_key"])
    
    return result

@router.get("/daily-orders")
def get_daily_orders(
    filter: Optional[str] = None,
    date_str: Optional[str] = None,
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can view daily orders")
        
    start_dt, end_dt = get_date_range(filter, date_str or date, start_date, end_date)
    
    sessions = db.query(models.Session).filter(
        models.Session.start_time >= start_dt,
        models.Session.start_time <= end_dt
    ).order_by(models.Session.start_time.desc()).all()
    
    result = []
    for session in sessions:
        table_number = session.table.table_number if session.table else "N/A"
        customer_name = session.customer_name if session.customer_name else "N/A"
        customer_phone = session.customer_phone if session.customer_phone else "N/A"
        
        total_amount = sum(order.total_amount for order in session.orders if order.status != "Pending")
        
        if total_amount > 0:
            result.append({
                "id": session.id,
                "table_number": table_number,
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "status": session.status,
                "total_amount": total_amount,
                "created_at": session.start_time
            })
            
    return result
