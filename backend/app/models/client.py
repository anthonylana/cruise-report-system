from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Client(Base):
    tablename = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)

    cruise_events = relationship("CruiseEvent", back_populates="client")
    food_reports = relationship("FoodReport", back_populates="client")

    def __repr__(self):
        return f"<Client id={self.id} name={self.name!r}>"
