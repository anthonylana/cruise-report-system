from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class SecurityIncident(Base):
    __tablename__ = "security_incidents"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("cruise_events.id", ondelete="CASCADE"), nullable=False)

    guard_name = Column(String, nullable=False)
    incident_description = Column(Text, nullable=True)

    event = relationship("CruiseEvent", back_populates="security_incidents")

    def __repr__(self):
        return f"<SecurityIncident id={self.id} guard_name={self.guard_name!r}>"
