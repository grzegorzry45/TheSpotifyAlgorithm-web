from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class PresetBase(BaseModel):
    name: str
    profile: Dict[str, Any]

class PresetCreate(PresetBase):
    pass

class Preset(PresetBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    credits: int
    presets: List[Preset] = []

    class Config:
        from_attributes = True # Changed from orm_mode = True for Pydantic v2.0+

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[EmailStr] = None

# Credit Transaction schemas
class CreditTransactionBase(BaseModel):
    amount: int
    transaction_type: str
    description: Optional[str] = None

class CreditTransaction(CreditTransactionBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Coupon schemas
class CouponBase(BaseModel):
    code: str
    credits: int
    max_uses: Optional[int] = None
    expires_at: Optional[datetime] = None
    description: Optional[str] = None

class CouponCreate(CouponBase):
    pass

class Coupon(CouponBase):
    id: int
    current_uses: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Coupon Redemption schemas
class CouponRedeemRequest(BaseModel):
    code: str

class CouponRedeemResponse(BaseModel):
    success: bool
    credits_added: int
    new_balance: int
    message: str

# Credits Balance schema
class CreditsBalance(BaseModel):
    credits: int
