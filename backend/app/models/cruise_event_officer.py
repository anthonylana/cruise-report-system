from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class CruiseEventOfficer(Base):
    tablename = "cruise_event_officers"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("cruise_events.id"), nullable=False)
    officer_id = Column(Integer, ForeignKey("officers.id"), nullable=False)

    # captain, first_mate, engineer, cruise_director, galley_manager, owner
    position = Column(String, nullable=False)

    event = relationship("CruiseEvent", back_populates="officer_assignments")
    officer = relationship("Officer", back_populates="event_assignments")

    def __repr__(self):
        return f"<CruiseEventOfficer event_id={self.event_id} officer_id={self.officer_id} position={self.position!r}>"
