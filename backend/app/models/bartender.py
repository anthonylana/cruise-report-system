from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Bartender(Base):
    __tablename__ = "bartenders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)

    bar_summaries = relationship("BarSummary", back_populates="bartender")

    def __repr__(self):
        return f"<Bartender id={self.id} name={self.name!r}>"
