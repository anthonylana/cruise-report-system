from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class BarSummary(Base):
    tablename = "bar_summaries"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("cruise_events.id"), nullable=False)
    bartender_id = Column(Integer, ForeignKey("bartenders.id"), nullable=False)
    deck_id = Column(Integer, ForeignKey("decks.id"), nullable=False)

    gross_sales = Column(Float, default=0)
    net_sales = Column(Float, default=0)

    house_sales = Column(Float, default=0)
    ticket_sales = Column(Float, default=0)
    account_sales = Column(Float, default=0)

    tip_out = Column(Float, default=0)

    tickets_tape = Column(Integer, nullable=True)
    tickets_actual = Column(Integer, nullable=True)
    tickets_diff = Column(Integer, nullable=True)

    alcohol_qty = Column(Integer, default=0)
    alcohol_value = Column(Float, default=0)

    pop_juice_qty = Column(Integer, default=0)
    pop_juice_value = Column(Float, default=0)

    event = relationship("CruiseEvent", back_populates="bar_summaries")
    bartender = relationship("Bartender", back_populates="bar_summaries")
    deck = relationship("Deck", back_populates="bar_summaries")

    @property
    def hst(self):
        """Computed sales between gross_sales and net_sales."""
        if self.gross_sales and self.net_sales:
            return self.gross_sales - self.net_sales
        return None

    def __repr__(self):
        return f"<BarSummary id={self.id} event_id={self.event_id} bartender_id={self.bartender_id}>"
