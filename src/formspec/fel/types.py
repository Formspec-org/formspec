"""FEL runtime value types.

All FEL values are wrapped in typed containers for strict type checking.
The number type uses Decimal for 18+ digit precision.
"""

from __future__ import annotations

import decimal
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Union

# Configure decimal context: 34-digit precision, banker's rounding
_FEL_CONTEXT = decimal.Context(prec=34, rounding=decimal.ROUND_HALF_EVEN)


def fel_decimal(value) -> Decimal:
    """Create a Decimal in the FEL context."""
    if isinstance(value, Decimal):
        return value
    return _FEL_CONTEXT.create_decimal(value)


# Singleton null
class _FelNullType:
    """The FEL null value — singleton."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self):
        return 'FelNull'

    def __bool__(self):
        return False


FelNull = _FelNullType()


@dataclass(frozen=True)
class FelNumber:
    value: Decimal

    def __repr__(self):
        return f'FelNumber({self.value})'


@dataclass(frozen=True)
class FelString:
    value: str

    def __repr__(self):
        return f'FelString({self.value!r})'


@dataclass(frozen=True)
class FelBoolean:
    value: bool

    def __repr__(self):
        return f'FelBoolean({self.value})'


FelTrue = FelBoolean(True)
FelFalse = FelBoolean(False)


def fel_bool(val: bool) -> FelBoolean:
    """Return the singleton FelTrue or FelFalse."""
    return FelTrue if val else FelFalse


@dataclass(frozen=True)
class FelDate:
    """Represents both date and datetime (FEL type is always 'date')."""
    value: Union[date, datetime]

    def __repr__(self):
        return f'FelDate({self.value})'


@dataclass(frozen=True)
class FelArray:
    elements: tuple

    def __repr__(self):
        return f'FelArray({list(self.elements)})'

    def __len__(self):
        return len(self.elements)


@dataclass(frozen=True)
class FelMoney:
    amount: Decimal
    currency: str

    def __repr__(self):
        return f'FelMoney({self.amount}, {self.currency!r})'


@dataclass(frozen=True)
class FelObject:
    """Internal object type — not first-class in FEL, supports dot-access."""
    fields: dict

    def __repr__(self):
        return f'FelObject({self.fields})'


FelValue = Union[
    _FelNullType, FelNumber, FelString, FelBoolean, FelDate,
    FelArray, FelMoney, FelObject,
]


def typeof(val: FelValue) -> str:
    """Return the FEL type name for typeOf() function."""
    if isinstance(val, _FelNullType):
        return 'null'
    if isinstance(val, FelNumber):
        return 'number'
    if isinstance(val, FelString):
        return 'string'
    if isinstance(val, FelBoolean):
        return 'boolean'
    if isinstance(val, FelDate):
        return 'date'
    if isinstance(val, FelArray):
        return 'array'
    if isinstance(val, FelMoney):
        return 'money'
    if isinstance(val, FelObject):
        return 'object'
    return 'unknown'


def is_null(val) -> bool:
    return isinstance(val, _FelNullType)


def to_python(val: FelValue):
    """Convert FEL value to Python native type for JSON serialization."""
    if is_null(val):
        return None
    if isinstance(val, FelNumber):
        return val.value
    if isinstance(val, FelString):
        return val.value
    if isinstance(val, FelBoolean):
        return val.value
    if isinstance(val, FelDate):
        return val.value.isoformat()
    if isinstance(val, FelArray):
        return [to_python(e) for e in val.elements]
    if isinstance(val, FelMoney):
        return {'amount': str(val.amount), 'currency': val.currency}
    if isinstance(val, FelObject):
        return {k: to_python(v) for k, v in val.fields.items()}
    return val


def from_python(val) -> FelValue:
    """Convert Python native value to FEL value."""
    if val is None:
        return FelNull
    if isinstance(val, bool):
        return FelTrue if val else FelFalse
    if isinstance(val, (int, float)):
        return FelNumber(fel_decimal(val))
    if isinstance(val, Decimal):
        return FelNumber(val)
    if isinstance(val, str):
        return FelString(val)
    if isinstance(val, datetime):
        return FelDate(val)
    if isinstance(val, date):
        return FelDate(val)
    if isinstance(val, (list, tuple)):
        return FelArray(tuple(from_python(e) for e in val))
    if isinstance(val, dict):
        # Check if it's a money value
        if 'amount' in val and 'currency' in val and len(val) == 2:
            try:
                return FelMoney(fel_decimal(val['amount']), val['currency'])
            except (decimal.InvalidOperation, TypeError, ValueError):
                pass  # Fall through to object
        return FelObject({k: from_python(v) for k, v in val.items()})
    return FelNull
