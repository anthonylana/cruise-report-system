from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Deck(Base):
    __tablename__ = "decks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)  # e.g. "1st Deck"

    bar_summaries = relationship("BarSummary", back_populates="deck")
    registers = relationship("Register", back_populates="deck")

    def __repr__(self):
        return f"<Deck id={self.id} name={self.name!r}>"