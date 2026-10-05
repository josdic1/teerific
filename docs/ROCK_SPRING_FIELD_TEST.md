# Rock Spring Golf Club field-test mapping

Added as an active 18-hole Teerific course:

- Rock Spring Golf Club
- 90 Rock Spring Rd, West Orange, NJ 07052
- Timezone: `America/New_York`
- Course slug: `rock-spring-golf-club`
- Course boundary: OpenStreetMap way `39680135`
- Departure point: clubhouse
- Hole par/yardage: white tees
- Hole detection zones: 28 m radius around each mapped green

The tee and green centers were reconstructed from the supplied Rock Spring satellite hole screenshots. The 28 m green zones are intentionally wider than the normal 18 m field-mapper radius so the first live field test can absorb small screenshot/georeferencing error without creating overlapping hole zones.

Apply only this new migration with:

```bash
export DATABASE_URL='postgresql://...'
./scripts/apply-rock-spring-course.sh
```
