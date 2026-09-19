from sqlalchemy import Column, Integer, String, DateTime, Time, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class CruiseEvent(Base):
    __tablename__ = "cruise_events"
    id = Column(Integer, primary_key=True, index=True)

    event_date = Column(DateTime, nullable=False)

    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)

    boarding_time = Column(DateTime, nullable=True)
    actual_boarding = Column(DateTime, nullable=True)
    actual_departure = Column(DateTime, nullable=True)

    guest_count = Column(Integer, nullable=True)
    water_taxi = Column(Integer, nullable=True)
    extra_time = Column(Time, nullable=True)

    weather = Column(String, nullable=True)
    function_type = Column(String, nullable=True)

    damages = Column(Text, nullable=True)
    floor_plan_followed = Column(Boolean, nullable=True)

    dj = Column(String, nullable=True)
    dj_feedback = Column(Text, nullable=True)

    lost_and_found = Column(Text, nullable=True)
    feedback = Column(Text, nullable=True)
    food_explain = Column(Text, nullable=True)
    other = Column(Text, nullable=True)

    source_filename = Column(String, nullable=True)

    # Relationships
    client = relationship("Client", back_populates="cruise_events")
    officer_assignments = relationship(
        "CruiseEventOfficer", back_populates="event", cascade="all, delete-orphan"
    )
    security_incidents = relationship(
        "SecurityIncident", back_populates="event", cascade="all, delete-orphan"
    )
    food_reports = relationship(
        "FoodReport", back_populates="event", cascade="all, delete-orphan"
    )
    bar_summaries = relationship(
        "BarSummary", back_populates="event", cascade="all, delete-orphan"
    )

    @property
    def cruising_time(self):
        """Computed duration between actual_boarding and actual_departure."""
        if self.actual_boarding and self.actual_departure:
            return self.actual_departure - self.actual_boarding
        return None

    def __repr__(self):
        return f"<CruiseEvent id={self.id} date={self.event_date}>"
