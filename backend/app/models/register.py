from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Register(Base):
    __tablename__ = "registers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)  # e.g. "Reg 1"
    deck_id = Column(Integer, ForeignKey("decks.id"), nullable=False)

    deck = relationship("Deck", back_populates="registers")
    bar_summaries = relationship("BarSummary", back_populates="register")

    def __repr__(self):
        return f"<Register id={self.id} name={self.name!r} deck_id={self.deck_id}>"
