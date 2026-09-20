from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class FoodReport(Base):
    __tablename__ = "food_reports"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("cruise_events.id", ondelete="CASCADE"), nullable=False)

    # Independent client - may differ from the cruise event's client
    # (e.g. catering company, "us", etc.)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)

    report_type = Column(String, nullable=True)  # "buffet" / "plated"

    substitutions = Column(Text, nullable=True)
    quality = Column(Text, nullable=True)
    quantity_shortages = Column(Text, nullable=True)
    presentation = Column(Text, nullable=True)
    problems_praises = Column(Text, nullable=True)
    other = Column(Text, nullable=True)
    items_required = Column(Text, nullable=True)
    completed_by = Column(String, nullable=True)

    event = relationship("CruiseEvent", back_populates="food_reports")
    client = relationship("Client", back_populates="food_reports")

    def __repr__(self):
        return f"<FoodReport id={self.id} event_id={self.event_id}>"
