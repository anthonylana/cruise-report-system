"""
scripts/dump_db.py

Quick and dirty script to print all data currently in the database.
Usage:
    python -m scripts.dump_db
Or:
    docker compose run --rm backend python -m scripts.dump_db
"""

from app.database import SessionLocal
from app.models import (
    Client,
    Officer,
    Bartender,
    Deck,
    Register,
    CruiseEvent,
    CruiseEventOfficer,
    BarSummary,
    FoodReport,
    SecurityIncident,
)


def print_header(title: str):
    print("\n" + "=" * 80)
    print(f" {title}")
    print("=" * 80)


def dump_table(db, model, label: str):
    rows = db.query(model).all()
    print_header(f"{label} ({len(rows)} rows)")
    if not rows:
        print("  (empty)")
        return
    for row in rows:
        print(f"  {row!r}")


def dump_cruise_events_detailed(db):
    events = db.query(CruiseEvent).all()
    print_header(f"CRUISE EVENTS - DETAILED ({len(events)} rows)")
    if not events:
        print("  (empty)")
        return

    for event in events:
        print(f"\n--- Event #{event.id} | {event.event_date} | Client: {event.client.name if event.client else 'N/A'} ---")
        print(f"  Boarding time:      {event.boarding_time}")
        print(f"  Actual boarding:    {event.actual_boarding}")
        print(f"  Actual departure:   {event.actual_departure}")
        print(f"  Cruising time:      {event.cruising_time}")
        print(f"  Guest count:        {event.guest_count}")
        print(f"  Water taxi:         {event.water_taxi}")
        print(f"  Extra time:         {event.extra_time}")
        print(f"  Weather:            {event.weather}")
        print(f"  Function type:      {event.function_type}")
        print(f"  Damages:            {event.damages}")
        print(f"  DJ feedback:        {event.dj_feedback}")
        print(f"  Lost and found:     {event.lost_and_found}")
        print(f"  Feedback:           {event.feedback}")
        print(f"  Food explain:       {event.food_explain}")
        print(f"  Other:              {event.other}")

        if event.officer_assignments:
            print("  Officers:")
            for assignment in event.officer_assignments:
                officer_name = assignment.officer.name if assignment.officer else "N/A"
                print(f"    - {assignment.position}: {officer_name}")
        else:
            print("  Officers: (none)")

        if event.bar_summaries:
            print("  Bar Summaries:")
            for bs in event.bar_summaries:
                bartender_name = bs.bartender.name if bs.bartender else "N/A"
                deck_name = bs.deck.name if bs.deck else "N/A"
                register_name = bs.register.name if bs.register else "N/A"
                print(
                    f"    - Register: {register_name} | Deck: {deck_name} | "
                    f"Bartender: {bartender_name} | Gross: {bs.gross_sales} | "
                    f"Tip out: {bs.tip_out} | Net: {bs.net_sales} | HST: {bs.hst}"
                )
        else:
            print("  Bar Summaries: (none)")

        if event.food_reports:
            print("  Food Reports:")
            for fr in event.food_reports:
                print(f"    - {fr!r}")

        if event.security_incidents:
            print("  Security Incidents:")
            for si in event.security_incidents:
                print(f"    - {si!r}")


def main():
    db = SessionLocal()
    try:
        # Summary tables first
        dump_table(db, Client, "CLIENTS")
        dump_table(db, Officer, "OFFICERS")
        dump_table(db, Bartender, "BARTENDERS")
        dump_table(db, Deck, "DECKS")
        dump_table(db, Register, "REGISTERS")

        # Then full detailed cruise event dump (with related data)
        dump_cruise_events_detailed(db)

        # Standalone dumps in case anything isn't linked to an event properly
        dump_table(db, CruiseEventOfficer, "CRUISE EVENT OFFICERS (raw)")
        dump_table(db, BarSummary, "BAR SUMMARIES (raw)")
        dump_table(db, FoodReport, "FOOD REPORTS (raw)")
        dump_table(db, SecurityIncident, "SECURITY INCIDENTS (raw)")

    finally:
        db.close()


if __name__ == "__main__":
    main()