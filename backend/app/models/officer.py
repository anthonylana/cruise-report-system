from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Officer(Base):
    __tablename__ = "officers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)

    event_assignments = relationship("CruiseEventOfficer", back_populates="officer")

    def __repr__(self):
        return f"<Officer id={self.id} name={self.name!r}>"
