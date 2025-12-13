from sqlalchemy import Boolean, Column, Integer, String, ForeignKey, JSON, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    credits = Column(Integer, default=1000)  # Start with 1000 credits
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    presets = relationship("Preset", back_populates="owner")
    credit_transactions = relationship("CreditTransaction", back_populates="user")
    coupon_redemptions = relationship("CouponRedemption", back_populates="user")

class Preset(Base):
    __tablename__ = "presets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    profile = Column(JSON)  # Stores the statistical profile
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="presets")

class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Integer)  # Can be negative for costs, positive for additions
    transaction_type = Column(String)  # 'signup_bonus', 'analysis_cost', 'coupon_redeemed', 'purchase'
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="credit_transactions")

class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True)
    credits = Column(Integer)  # How many credits this coupon gives
    max_uses = Column(Integer, nullable=True)  # NULL = unlimited
    current_uses = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=True)  # NULL = never expires
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    redemptions = relationship("CouponRedemption", back_populates="coupon")

class CouponRedemption(Base):
    __tablename__ = "coupon_redemptions"
    __table_args__ = (UniqueConstraint('coupon_id', 'user_id', name='unique_user_coupon'),)

    id = Column(Integer, primary_key=True, index=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    credits_added = Column(Integer)  # Snapshot of credits added
    redeemed_at = Column(DateTime, default=datetime.utcnow)

    coupon = relationship("Coupon", back_populates="redemptions")
    user = relationship("User", back_populates="coupon_redemptions")