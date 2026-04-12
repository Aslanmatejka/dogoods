"""
DoGoods AI Tool Signatures & Implementations
----------------------------------------------
OpenAI function-calling tool definitions for the DoGoods AI assistant.
Implements: search_food_near_user, get_user_profile, get_pickup_schedule,
            create_reminder, get_mapbox_route, query_distribution_centers,
            get_user_dashboard, check_pickup_schedule.
"""

import json
import logging
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

logger = logging.getLogger("ai_tools")

MAPBOX_TOKEN = os.getenv("VITE_MAPBOX_TOKEN", "")
MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox"

# ---------------------------------------------------------------------------
# OpenAI function-calling tool definitions
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "search_food_near_user",
            "description": (
                "Search for available food listings near a user's location. "
                "Returns food items that are currently available for pickup "
                "within the specified radius."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The UUID of the user to search near",
                    },
                    "radius_km": {
                        "type": "number",
                        "description": "Search radius in kilometers (default 10)",
                        "default": 10,
                    },
                    "food_type": {
                        "type": "string",
                        "description": (
                            "Optional food category filter: "
                            "proteins, grains, vegetables, fruits, dairy, prepared, bakery, other"
                        ),
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of results to return (default 10)",
                        "default": 10,
                    },
                },
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_profile",
            "description": (
                "Retrieve a user's profile information including name, location, "
                "preferences, dietary restrictions, and activity history summary."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The UUID of the user",
                    },
                },
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pickup_schedule",
            "description": (
                "Get upcoming food pickup or distribution event schedules. "
                "Can filter by user's claimed items or by community events."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The UUID of the user",
                    },
                    "include_community_events": {
                        "type": "boolean",
                        "description": "Whether to include community distribution events (default true)",
                        "default": True,
                    },
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days to look ahead (default 7)",
                        "default": 7,
                    },
                },
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": (
                "Create a reminder for the user. Can be used for pickup reminders, "
                "listing expiry alerts, distribution events, or general reminders."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The UUID of the user",
                    },
                    "message": {
                        "type": "string",
                        "description": "The reminder message text",
                    },
                    "trigger_time": {
                        "type": "string",
                        "description": "ISO 8601 datetime for when to send the reminder",
                    },
                    "reminder_type": {
                        "type": "string",
                        "enum": ["pickup", "listing_expiry", "distribution_event", "general"],
                        "description": "Type of reminder (default 'general')",
                        "default": "general",
                    },
                    "related_id": {
                        "type": "string",
                        "description": "Optional UUID of related entity (food listing, event, etc.)",
                    },
                },
                "required": ["user_id", "message", "trigger_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_mapbox_route",
            "description": (
                "Get walking or driving directions between two points. "
                "Returns step-by-step directions, distance, and estimated travel time. "
                "Useful when a user wants to know how to get to a food pickup location."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "origin_lng": {
                        "type": "number",
                        "description": "Origin longitude",
                    },
                    "origin_lat": {
                        "type": "number",
                        "description": "Origin latitude",
                    },
                    "dest_lng": {
                        "type": "number",
                        "description": "Destination longitude",
                    },
                    "dest_lat": {
                        "type": "number",
                        "description": "Destination latitude",
                    },
                    "profile": {
                        "type": "string",
                        "enum": ["driving", "walking", "cycling"],
                        "description": "Travel mode (default 'driving')",
                        "default": "driving",
                    },
                },
                "required": ["origin_lng", "origin_lat", "dest_lng", "dest_lat"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_distribution_centers",
            "description": (
                "Query upcoming community food distribution events and centers. "
                "Returns event details including location, hours, capacity, "
                "and registration status. Can filter by date range and status."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days ahead to search (default 14)",
                        "default": 14,
                    },
                    "status": {
                        "type": "string",
                        "enum": ["scheduled", "in_progress", "completed", "cancelled"],
                        "description": "Filter by event status (default 'scheduled')",
                        "default": "scheduled",
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum results to return (default 10)",
                        "default": 10,
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_dashboard",
            "description": (
                "Get a comprehensive user dashboard including profile data, "
                "dietary restrictions, favorite food categories, active listings, "
                "pending claims, upcoming reminders, and impact stats. "
                "Use this to personalize conversations."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The UUID of the user",
                    },
                },
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_pickup_schedule",
            "description": (
                "Check a user's upcoming reminders and scheduled pickups "
                "from the ai_reminders table. Returns pending reminders "
                "organized by type (pickup, listing_expiry, distribution_event, general)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "The UUID of the user",
                    },
                    "include_sent": {
                        "type": "boolean",
                        "description": "Include already-sent reminders (default false)",
                        "default": False,
                    },
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days to look ahead (default 14)",
                        "default": 14,
                    },
                },
                "required": ["user_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recipes",
            "description": (
                "Get recipe suggestions based on specific ingredients or based on "
                "a user's claimed/available food items from the platform. "
                "When user_id is provided, looks up their active food claims to "
                "suggest recipes they can actually make. Returns 3 creative recipes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "ingredients": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of ingredient names to base recipes on",
                    },
                    "user_id": {
                        "type": "string",
                        "description": (
                            "Optional user UUID — if provided, fetches their claimed "
                            "food items and uses those as ingredients"
                        ),
                    },
                    "dietary_preferences": {
                        "type": "string",
                        "description": (
                            "Optional dietary restrictions or preferences "
                            "(e.g. vegetarian, vegan, gluten-free, halal, kosher)"
                        ),
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_storage_tips",
            "description": (
                "Get food storage and preservation tips for specific food items "
                "or for food a user has claimed/listed on the platform. "
                "Returns optimal storage conditions, shelf life, signs of spoilage, "
                "and tips to extend freshness."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "food_items": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of food item names to get storage tips for",
                    },
                    "user_id": {
                        "type": "string",
                        "description": (
                            "Optional user UUID — if provided, fetches their active "
                            "food claims/listings and gives storage tips for those items"
                        ),
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_active_communities",
            "description": (
                "Find active local food sharing communities and groups near a user. "
                "Returns community names, locations, contact info, hours, descriptions, "
                "and impact stats (food given, families helped). Can optionally filter "
                "by proximity to a user's location."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": (
                            "Optional user UUID — if provided, sorts communities "
                            "by distance from the user's location"
                        ),
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of communities to return (default 10)",
                        "default": 10,
                    },
                },
                "required": [],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# Tool execution dispatcher
# ---------------------------------------------------------------------------

async def execute_tool(name: str, arguments: dict) -> dict:
    """Route a tool call to its handler and return the result."""
    handlers = {
        "search_food_near_user": _search_food_near_user,
        "get_user_profile": _get_user_profile,
        "get_pickup_schedule": _get_pickup_schedule,
        "create_reminder": _create_reminder,
        "get_mapbox_route": _get_mapbox_route,
        "query_distribution_centers": _query_distribution_centers,
        "get_user_dashboard": _get_user_dashboard,
        "check_pickup_schedule": _check_pickup_schedule,
        "get_recipes": _get_recipes,
        "get_storage_tips": _get_storage_tips,
        "get_active_communities": _get_active_communities,
    }

    handler = handlers.get(name)
    if handler is None:
        logger.warning("Unknown tool requested: %s", name)
        return {"error": f"Unknown tool: {name}"}

    try:
        return await handler(**arguments)
    except Exception as exc:
        logger.error("Tool %s failed: %s", name, exc)
        return {"error": f"Tool execution failed: {str(exc)}"}


# ---------------------------------------------------------------------------
# Haversine distance helper
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two lat/lng points."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

async def _search_food_near_user(
    user_id: str,
    radius_km: float = 10,
    food_type: Optional[str] = None,
    max_results: int = 10,
) -> dict:
    """Search available food listings near the user's location.

    1. Fetch the user's location from the users table
    2. Query food_listings with status in [approved, active], not expired
    3. Filter by Haversine distance and optional food_type
    4. Format natural-language-friendly results
    """
    from backend.ai_engine import supabase_get

    logger.info(
        "search_food_near_user: user=%s radius=%skm type=%s",
        user_id, radius_km, food_type,
    )

    # --- 1. Get user location ---
    user_lat, user_lng = None, None
    try:
        user_rows = await supabase_get("users", {
            "id": f"eq.{user_id}",
            "select": "id,name,organization,location,created_at",
        })
        if user_rows:
            profile = user_rows[0]
            loc = profile.get("location")
            if isinstance(loc, dict):
                user_lat = loc.get("latitude")
                user_lng = loc.get("longitude")
            elif isinstance(loc, str):
                # location might be stored as text; try parsing
                try:
                    parsed = json.loads(loc)
                    user_lat = parsed.get("latitude")
                    user_lng = parsed.get("longitude")
                except (ValueError, TypeError):
                    pass
    except Exception as exc:
        logger.error("User lookup failed: %s", exc)

    # --- 2. Query food_listings ---
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    params: dict = {
        "select": (
            "id,title,description,category,quantity,unit,"
            "latitude,longitude,full_address,donor_name,"
            "expiry_date,pickup_by,status,"
            "dietary_tags,allergens,created_at"
        ),
        "status": "in.(approved,active)",
        "expiry_date": f"gte.{today_str}",
        "order": "created_at.desc",
        "limit": "100",
    }
    if food_type:
        params["category"] = f"eq.{food_type}"

    try:
        listings = await supabase_get("food_listings", params)
    except Exception as exc:
        logger.error("Food listings fetch failed: %s", exc)
        return {"results": [], "total": 0, "error": f"Database query failed: {exc}"}

    # --- 3. Filter by distance ---
    results = []
    for listing in listings:
        lat = listing.get("latitude")
        lng = listing.get("longitude")

        if lat is not None and lng is not None and user_lat is not None and user_lng is not None:
            try:
                dist = _haversine(user_lat, user_lng, float(lat), float(lng))
            except (ValueError, TypeError):
                dist = None
        else:
            dist = None

        # Include listing if within radius, or if no location data available
        if dist is not None and dist > radius_km:
            continue

        result = {
            "id": listing.get("id"),
            "title": listing.get("title"),
            "description": listing.get("description", "")[:200],
            "category": listing.get("category"),
            "quantity": listing.get("quantity"),
            "unit": listing.get("unit"),
            "address": listing.get("full_address") or listing.get("location", ""),
            "donor_name": listing.get("donor_name"),
            "expiry_date": listing.get("expiry_date"),
            "pickup_by": listing.get("pickup_by"),
            "dietary_tags": listing.get("dietary_tags", []),
            "allergens": listing.get("allergens", []),
            "distance_km": round(dist, 1) if dist is not None else None,
            "latitude": lat,
            "longitude": lng,
        }
        results.append(result)

    # Sort by distance (nearest first), nulls last
    results.sort(key=lambda r: r["distance_km"] if r["distance_km"] is not None else 9999)
    results = results[:max_results]

    # --- 4. Format natural response summary ---
    if results:
        summary_parts = []
        for i, r in enumerate(results, 1):
            dist_str = f"{r['distance_km']} km away" if r["distance_km"] is not None else "distance unknown"
            summary_parts.append(
                f"{i}. **{r['title']}** ({r['category'] or 'uncategorized'}) — "
                f"{r['quantity']} {r['unit'] or 'items'}, {dist_str}. "
                f"Pickup: {r['address'] or 'contact donor'}."
            )
        summary = f"Found {len(results)} food item(s) near you:\n" + "\n".join(summary_parts)
    else:
        summary = (
            "No available food listings found within your area right now. "
            "Try expanding your search radius or check back later!"
        )

    return {
        "results": results,
        "total": len(results),
        "radius_km": radius_km,
        "user_location_available": user_lat is not None,
        "summary": summary,
    }


async def _get_user_profile(user_id: str) -> dict:
    """Retrieve user profile with activity summary."""
    from backend.ai_engine import supabase_get

    logger.info("get_user_profile: user=%s", user_id)
    try:
        rows = await supabase_get("users", {
            "id": f"eq.{user_id}",
            "select": (
                "id,name,email,phone,"
                "is_admin,avatar_url,role,account_type,organization,"
                "created_at"
            ),
        })
        if not rows:
            return {"user_id": user_id, "profile": None, "message": "User not found."}

        profile = rows[0]

        # Count listings and claims
        listings_count, claims_count = 0, 0
        try:
            listing_rows = await supabase_get("food_listings", {
                "user_id": f"eq.{user_id}",
                "select": "id",
            })
            listings_count = len(listing_rows)
        except Exception:
            pass
        try:
            claim_rows = await supabase_get("food_claims", {
                "claimer_id": f"eq.{user_id}",
                "select": "id",
            })
            claims_count = len(claim_rows)
        except Exception:
            pass

        return {
            "user_id": user_id,
            "profile": {
                "name": profile.get("name") or profile.get("email"),
                "email": profile.get("email"),
                "role": profile.get("role", "member"),
                "account_type": profile.get("account_type"),
                "organization": profile.get("organization"),
                "is_admin": profile.get("is_admin", False),
                "member_since": profile.get("created_at"),
            },
            "activity": {
                "listings_shared": listings_count,
                "food_claimed": claims_count,
            },
        }
    except Exception as exc:
        logger.error("Profile fetch failed: %s", exc)
        return {"user_id": user_id, "profile": None, "error": str(exc)}


async def _get_pickup_schedule(
    user_id: str,
    include_community_events: bool = True,
    days_ahead: int = 7,
) -> dict:
    """Get upcoming pickup and distribution schedules."""
    from backend.ai_engine import supabase_get

    logger.info(
        "get_pickup_schedule: user=%s events=%s days=%d",
        user_id, include_community_events, days_ahead,
    )

    now = datetime.now(timezone.utc)
    future = now + timedelta(days=days_ahead)

    # --- Pending pickups (user's claimed food) ---
    pickups = []
    try:
        claims = await supabase_get("food_claims", {
            "claimer_id": f"eq.{user_id}",
            "status": "in.(pending,approved)",
            "select": "id,food_id,status,pickup_date,notes,created_at",
            "order": "pickup_date.asc",
        })
        for claim in claims:
            # Fetch linked food listing summary
            food_title = "Food item"
            try:
                food_rows = await supabase_get("food_listings", {
                    "id": f"eq.{claim['food_id']}",
                    "select": "title,full_address,location",
                })
                if food_rows:
                    food_title = food_rows[0].get("title", food_title)
                    claim["address"] = (
                        food_rows[0].get("full_address")
                        or food_rows[0].get("location", "")
                    )
            except Exception:
                pass

            pickups.append({
                "claim_id": claim.get("id"),
                "food_title": food_title,
                "status": claim.get("status"),
                "pickup_date": claim.get("pickup_date"),
                "address": claim.get("address", ""),
                "notes": claim.get("notes"),
            })
    except Exception as exc:
        logger.error("Claims fetch failed: %s", exc)

    # --- Community distribution events ---
    events = []
    if include_community_events:
        try:
            today_str = now.strftime("%Y-%m-%d")
            future_str = future.strftime("%Y-%m-%d")
            event_rows = await supabase_get("distribution_events", {
                "event_date": f"gte.{today_str}",
                "status": "eq.scheduled",
                "select": (
                    "id,title,description,location,event_date,"
                    "start_time,end_time,capacity,registered_count"
                ),
                "order": "event_date.asc",
                "limit": "10",
            })
            for ev in event_rows:
                spots_left = (ev.get("capacity") or 0) - (ev.get("registered_count") or 0)
                events.append({
                    "event_id": ev.get("id"),
                    "title": ev.get("title"),
                    "description": (ev.get("description") or "")[:200],
                    "location": ev.get("location"),
                    "date": ev.get("event_date"),
                    "start_time": ev.get("start_time"),
                    "end_time": ev.get("end_time"),
                    "spots_available": max(spots_left, 0),
                })
        except Exception as exc:
            logger.error("Events fetch failed: %s", exc)

    return {
        "pickups": pickups,
        "events": events,
        "days_ahead": days_ahead,
    }


async def _create_reminder(
    user_id: str,
    message: str,
    trigger_time: str,
    reminder_type: str = "general",
    related_id: Optional[str] = None,
) -> dict:
    """Create a reminder in the ai_reminders table."""
    from backend.ai_engine import supabase_post

    logger.info(
        "create_reminder: user=%s type=%s time=%s",
        user_id, reminder_type, trigger_time,
    )

    # Validate trigger_time is in the future
    try:
        trigger_dt = datetime.fromisoformat(trigger_time.replace("Z", "+00:00"))
        if trigger_dt < datetime.now(timezone.utc):
            return {
                "created": False,
                "error": "Trigger time must be in the future.",
            }
    except (ValueError, TypeError):
        return {
            "created": False,
            "error": "Invalid trigger_time format. Use ISO 8601.",
        }

    data = {
        "user_id": user_id,
        "message": message,
        "trigger_time": trigger_time,
        "reminder_type": reminder_type,
        "sent": False,
    }
    if related_id:
        data["related_id"] = related_id

    try:
        rows = await supabase_post("ai_reminders", data)
        return {
            "created": True,
            "reminder_id": rows[0].get("id") if rows else None,
            "trigger_time": trigger_time,
            "message": f"Reminder set for {trigger_time}.",
        }
    except Exception as exc:
        logger.error("Reminder creation failed: %s", exc)
        return {"created": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# NEW: get_mapbox_route — proxy Mapbox Directions API
# ---------------------------------------------------------------------------

async def _get_mapbox_route(
    origin_lng: float,
    origin_lat: float,
    dest_lng: float,
    dest_lat: float,
    profile: str = "driving",
) -> dict:
    """Proxy Mapbox Directions API and return a human-friendly summary.

    Returns step-by-step directions, total distance, and estimated travel time.
    """
    logger.info(
        "get_mapbox_route: (%s,%s)->(%s,%s) profile=%s",
        origin_lat, origin_lng, dest_lat, dest_lng, profile,
    )

    if not MAPBOX_TOKEN:
        return {
            "error": "Mapbox token not configured.",
            "fallback": (
                f"Straight-line distance: ~{_haversine(origin_lat, origin_lng, dest_lat, dest_lng):.1f} km. "
                "Configure VITE_MAPBOX_TOKEN for turn-by-turn directions."
            ),
        }

    # Validate profile
    if profile not in ("driving", "walking", "cycling"):
        profile = "driving"

    coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    url = f"{MAPBOX_DIRECTIONS_URL}/{profile}/{coords}"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params={
                "access_token": MAPBOX_TOKEN,
                "geometries": "geojson",
                "overview": "simplified",
                "steps": "true",
                "language": "en",
            })
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("Mapbox API error: %s", exc.response.text[:300])
        return {"error": f"Mapbox API error: HTTP {exc.response.status_code}"}
    except Exception as exc:
        logger.error("Mapbox request failed: %s", exc)
        return {"error": f"Mapbox request failed: {exc}"}

    routes = data.get("routes", [])
    if not routes:
        return {"error": "No route found between these locations."}

    route = routes[0]
    duration_sec = route.get("duration", 0)
    distance_m = route.get("distance", 0)

    # Build step-by-step directions
    steps = []
    legs = route.get("legs", [])
    for leg in legs:
        for step in leg.get("steps", []):
            maneuver = step.get("maneuver", {})
            instruction = maneuver.get("instruction", "")
            step_dist = step.get("distance", 0)
            step_dur = step.get("duration", 0)
            if instruction:
                steps.append({
                    "instruction": instruction,
                    "distance_m": round(step_dist),
                    "duration_sec": round(step_dur),
                })

    # Human-friendly summary
    dist_km = distance_m / 1000
    if duration_sec < 60:
        time_str = f"{int(duration_sec)} seconds"
    elif duration_sec < 3600:
        time_str = f"{int(duration_sec // 60)} minutes"
    else:
        hours = int(duration_sec // 3600)
        mins = int((duration_sec % 3600) // 60)
        time_str = f"{hours}h {mins}min"

    summary = (
        f"Route by {profile}: {dist_km:.1f} km, approximately {time_str}. "
        f"{len(steps)} navigation step(s)."
    )

    return {
        "profile": profile,
        "distance_km": round(dist_km, 2),
        "duration_minutes": round(duration_sec / 60, 1),
        "duration_text": time_str,
        "steps": steps[:20],  # cap to avoid huge payloads
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# NEW: query_distribution_centers — community events + locations
# ---------------------------------------------------------------------------

async def _query_distribution_centers(
    days_ahead: int = 14,
    status: str = "scheduled",
    max_results: int = 10,
) -> dict:
    """Query upcoming distribution events from the distribution_events table.

    Returns event details: title, location, hours, capacity/availability.
    """
    from backend.ai_engine import supabase_get

    logger.info(
        "query_distribution_centers: days=%d status=%s max=%d",
        days_ahead, status, max_results,
    )

    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    future_str = (now + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    try:
        rows = await supabase_get("distribution_events", {
            "event_date": f"gte.{today_str}",
            "status": f"eq.{status}",
            "select": (
                "id,title,description,location,event_date,"
                "start_time,end_time,capacity,registered_count,status"
            ),
            "order": "event_date.asc",
            "limit": str(max_results),
        })
    except Exception as exc:
        logger.error("Distribution events query failed: %s", exc)
        return {"centers": [], "total": 0, "error": str(exc)}

    centers = []
    for ev in rows:
        capacity = ev.get("capacity") or 0
        registered = ev.get("registered_count") or 0
        spots_left = max(capacity - registered, 0)

        hours_str = ""
        if ev.get("start_time") and ev.get("end_time"):
            hours_str = f"{ev['start_time']} - {ev['end_time']}"
        elif ev.get("start_time"):
            hours_str = f"Starts at {ev['start_time']}"

        centers.append({
            "event_id": ev.get("id"),
            "title": ev.get("title"),
            "description": (ev.get("description") or "")[:300],
            "location": ev.get("location"),
            "date": ev.get("event_date"),
            "hours": hours_str,
            "capacity": capacity,
            "registered": registered,
            "spots_available": spots_left,
            "status": ev.get("status"),
        })

    # Natural summary
    if centers:
        parts = []
        for i, c in enumerate(centers, 1):
            spots_info = (
                f"{c['spots_available']} spots left"
                if c["capacity"] > 0
                else "open capacity"
            )
            parts.append(
                f"{i}. **{c['title']}** — {c['date']}, {c['hours']}. "
                f"Location: {c['location'] or 'TBA'}. {spots_info}."
            )
        summary = (
            f"Found {len(centers)} upcoming distribution event(s):\n"
            + "\n".join(parts)
        )
    else:
        summary = (
            f"No {status} distribution events found in the next {days_ahead} days. "
            "Check back soon or contact your community organizer!"
        )

    return {
        "centers": centers,
        "total": len(centers),
        "days_searched": days_ahead,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# get_user_dashboard — comprehensive dashboard for personalization
# ---------------------------------------------------------------------------

async def _get_user_dashboard(user_id: str) -> dict:
    """Return a rich user dashboard: profile, restrictions, favorites,
    active listings, pending claims, upcoming reminders, and impact stats."""
    from backend.ai_engine import supabase_get

    logger.info("get_user_dashboard: user=%s", user_id)

    dashboard: dict = {
        "user_id": user_id,
        "profile": None,
        "dietary_restrictions": None,
        "favorites": [],
        "active_listings": [],
        "pending_claims": [],
        "upcoming_reminders": [],
        "impact_summary": {},
    }

    # --- Profile + dietary info ---
    try:
        rows = await supabase_get("users", {
            "id": f"eq.{user_id}",
            "select": (
                "id,name,email,phone,location,"
                "is_admin,role,account_type,organization,"
                "dietary_restrictions,sms_opt_in,sms_notifications_enabled,created_at"
            ),
        })
        if rows:
            p = rows[0]
            dashboard["profile"] = {
                "name": p.get("name") or p.get("email", ""),
                "email": p.get("email"),
                "phone": p.get("phone"),
                "location": p.get("location"),
                "role": p.get("role", "member"),
                "account_type": p.get("account_type"),
                "organization": p.get("organization"),
                "is_admin": p.get("is_admin", False),
                "sms_opt_in": p.get("sms_opt_in", False),
                "sms_notifications_enabled": p.get("sms_notifications_enabled", False),
                "member_since": p.get("created_at"),
            }
            dashboard["dietary_restrictions"] = p.get("dietary_restrictions")
    except Exception as exc:
        logger.error("Dashboard profile fetch failed: %s", exc)

    # --- Favorite categories (top categories from claimed food) ---
    try:
        claims = await supabase_get("food_claims", {
            "claimer_id": f"eq.{user_id}",
            "select": "food_id",
            "limit": "50",
        })
        if claims:
            food_ids = [c["food_id"] for c in claims if c.get("food_id")]
            category_counts: dict[str, int] = {}
            for fid in food_ids[:30]:  # limit lookups
                try:
                    food_rows = await supabase_get("food_listings", {
                        "id": f"eq.{fid}",
                        "select": "category",
                    })
                    if food_rows and food_rows[0].get("category"):
                        cat = food_rows[0]["category"]
                        category_counts[cat] = category_counts.get(cat, 0) + 1
                except Exception:
                    pass
            # Sort by frequency
            sorted_cats = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
            dashboard["favorites"] = [
                {"category": cat, "claim_count": cnt}
                for cat, cnt in sorted_cats[:5]
            ]
    except Exception as exc:
        logger.error("Dashboard favorites fetch failed: %s", exc)

    # --- Active listings (user's own) ---
    try:
        listings = await supabase_get("food_listings", {
            "user_id": f"eq.{user_id}",
            "status": "in.(approved,active,pending)",
            "select": "id,title,category,quantity,unit,status,expiry_date,created_at",
            "order": "created_at.desc",
            "limit": "10",
        })
        dashboard["active_listings"] = [
            {
                "id": l.get("id"),
                "title": l.get("title"),
                "category": l.get("category"),
                "quantity": l.get("quantity"),
                "unit": l.get("unit"),
                "status": l.get("status"),
                "expiry_date": l.get("expiry_date"),
            }
            for l in listings
        ]
    except Exception as exc:
        logger.error("Dashboard listings fetch failed: %s", exc)

    # --- Pending claims ---
    try:
        pending = await supabase_get("food_claims", {
            "claimer_id": f"eq.{user_id}",
            "status": "in.(pending,approved)",
            "select": "id,food_id,status,pickup_date,created_at",
            "order": "created_at.desc",
            "limit": "10",
        })
        for claim in pending:
            title = "Food item"
            try:
                food_rows = await supabase_get("food_listings", {
                    "id": f"eq.{claim['food_id']}",
                    "select": "title,full_address,location",
                })
                if food_rows:
                    title = food_rows[0].get("title", title)
                    claim["address"] = (
                        food_rows[0].get("full_address")
                        or food_rows[0].get("location", "")
                    )
            except Exception:
                pass
            dashboard["pending_claims"].append({
                "claim_id": claim.get("id"),
                "food_title": title,
                "status": claim.get("status"),
                "pickup_date": claim.get("pickup_date"),
                "address": claim.get("address", ""),
            })
    except Exception as exc:
        logger.error("Dashboard claims fetch failed: %s", exc)

    # --- Upcoming reminders ---
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        reminders = await supabase_get("ai_reminders", {
            "user_id": f"eq.{user_id}",
            "sent": "eq.false",
            "trigger_time": f"gte.{now_iso}",
            "select": "id,message,trigger_time,reminder_type,created_at",
            "order": "trigger_time.asc",
            "limit": "10",
        })
        dashboard["upcoming_reminders"] = [
            {
                "id": r.get("id"),
                "message": r.get("message"),
                "trigger_time": r.get("trigger_time"),
                "type": r.get("reminder_type"),
            }
            for r in reminders
        ]
    except Exception as exc:
        logger.error("Dashboard reminders fetch failed: %s", exc)

    # --- Impact summary ---
    try:
        # Count total completed shares
        completed_listings = await supabase_get("food_listings", {
            "user_id": f"eq.{user_id}",
            "status": "in.(completed,claimed)",
            "select": "id",
        })
        completed_claims = await supabase_get("food_claims", {
            "claimer_id": f"eq.{user_id}",
            "status": "eq.approved",
            "select": "id",
        })
        dashboard["impact_summary"] = {
            "food_shared_count": len(completed_listings),
            "food_received_count": len(completed_claims),
            "total_contributions": len(completed_listings) + len(completed_claims),
        }
    except Exception as exc:
        logger.error("Dashboard impact fetch failed: %s", exc)

    return dashboard


# ---------------------------------------------------------------------------
# check_pickup_schedule — reads ai_reminders + food_claims
# ---------------------------------------------------------------------------

async def _check_pickup_schedule(
    user_id: str,
    include_sent: bool = False,
    days_ahead: int = 14,
) -> dict:
    """Check user's reminders table and pending pickups, organized by type."""
    from backend.ai_engine import supabase_get

    logger.info(
        "check_pickup_schedule: user=%s include_sent=%s days=%d",
        user_id, include_sent, days_ahead,
    )

    now = datetime.now(timezone.utc)
    future = now + timedelta(days=days_ahead)
    now_iso = now.isoformat()
    future_iso = future.isoformat()

    # --- Reminders from ai_reminders table ---
    reminder_params: dict = {
        "user_id": f"eq.{user_id}",
        "trigger_time": f"lte.{future_iso}",
        "select": "id,message,trigger_time,reminder_type,sent,sent_at,related_id,created_at",
        "order": "trigger_time.asc",
        "limit": "50",
    }
    if not include_sent:
        reminder_params["sent"] = "eq.false"

    reminders_by_type: dict[str, list] = {
        "pickup": [],
        "listing_expiry": [],
        "distribution_event": [],
        "general": [],
    }

    try:
        reminders = await supabase_get("ai_reminders", reminder_params)
        for r in reminders:
            rtype = r.get("reminder_type", "general")
            if rtype not in reminders_by_type:
                rtype = "general"
            reminders_by_type[rtype].append({
                "id": r.get("id"),
                "message": r.get("message"),
                "trigger_time": r.get("trigger_time"),
                "sent": r.get("sent", False),
                "sent_at": r.get("sent_at"),
                "related_id": r.get("related_id"),
            })
    except Exception as exc:
        logger.error("Reminders fetch failed: %s", exc)

    # --- Pending pickups from food_claims ---
    pickups = []
    try:
        claims = await supabase_get("food_claims", {
            "claimer_id": f"eq.{user_id}",
            "status": "in.(pending,approved)",
            "select": "id,food_id,status,pickup_date,notes,created_at",
            "order": "pickup_date.asc",
            "limit": "20",
        })
        for claim in claims:
            food_info = {"title": "Food item", "address": ""}
            try:
                food_rows = await supabase_get("food_listings", {
                    "id": f"eq.{claim['food_id']}",
                    "select": "title,full_address,location,pickup_by,expiry_date",
                })
                if food_rows:
                    f = food_rows[0]
                    food_info = {
                        "title": f.get("title", "Food item"),
                        "address": f.get("full_address") or f.get("location", ""),
                        "pickup_by": f.get("pickup_by"),
                        "expiry_date": f.get("expiry_date"),
                    }
            except Exception:
                pass

            pickups.append({
                "claim_id": claim.get("id"),
                "food_title": food_info.get("title"),
                "status": claim.get("status"),
                "pickup_date": claim.get("pickup_date"),
                "pickup_by": food_info.get("pickup_by"),
                "address": food_info.get("address", ""),
                "expiry_date": food_info.get("expiry_date"),
                "notes": claim.get("notes"),
            })
    except Exception as exc:
        logger.error("Pickup claims fetch failed: %s", exc)

    # --- Summary ---
    total_pending = sum(len(v) for v in reminders_by_type.values())
    summary_parts = []
    if pickups:
        summary_parts.append(f"{len(pickups)} pending food pickup(s)")
    if reminders_by_type["pickup"]:
        summary_parts.append(f"{len(reminders_by_type['pickup'])} pickup reminder(s)")
    if reminders_by_type["distribution_event"]:
        summary_parts.append(
            f"{len(reminders_by_type['distribution_event'])} event reminder(s)"
        )
    if reminders_by_type["listing_expiry"]:
        summary_parts.append(
            f"{len(reminders_by_type['listing_expiry'])} listing expiry alert(s)"
        )
    if reminders_by_type["general"]:
        summary_parts.append(
            f"{len(reminders_by_type['general'])} general reminder(s)"
        )

    if summary_parts:
        summary = "Your upcoming schedule: " + ", ".join(summary_parts) + "."
    else:
        summary = "You have no pending pickups or reminders right now."

    return {
        "pickups": pickups,
        "reminders": reminders_by_type,
        "total_reminders": total_pending,
        "total_pickups": len(pickups),
        "days_ahead": days_ahead,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# get_recipes — suggest recipes from ingredients or user's claimed food
# ---------------------------------------------------------------------------

async def _get_recipes(
    ingredients: list[str] | None = None,
    user_id: str | None = None,
    dietary_preferences: str | None = None,
) -> dict:
    """Generate recipe suggestions based on ingredients or a user's food claims."""
    from backend.ai_engine import supabase_get, legacy_ai_request, _extract_content, DEFAULT_MODEL

    logger.info("get_recipes: ingredients=%s user_id=%s", ingredients, user_id)

    # If user_id provided, look up their claimed food items
    if not ingredients and user_id:
        ingredients = []
        try:
            claims = await supabase_get("food_claims", {
                "claimer_id": f"eq.{user_id}",
                "status": "in.(pending,approved)",
                "select": "food_id",
                "limit": "20",
            })
            food_ids = [c["food_id"] for c in claims if c.get("food_id")]
            for fid in food_ids[:10]:
                try:
                    rows = await supabase_get("food_listings", {
                        "id": f"eq.{fid}",
                        "select": "title,category",
                    })
                    if rows:
                        ingredients.append(rows[0].get("title", ""))
                except Exception:
                    pass
        except Exception as exc:
            logger.error("Failed to fetch user claims for recipes: %s", exc)

    if not ingredients:
        return {"error": "No ingredients provided and no claimed food found for user."}

    diet_note = ""
    if dietary_preferences:
        diet_note = f" The recipes must be {dietary_preferences}."

    prompt = (
        "Suggest 3 creative recipes using some or all of these ingredients: "
        f"{', '.join(ingredients)}.{diet_note} "
        "For each recipe provide: name, ingredients list with quantities, "
        "step-by-step instructions, prep time, cook time, and servings. "
        "Return valid JSON array."
    )
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful culinary assistant for a food-sharing community.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.8,
        "max_tokens": 1500,
    }

    try:
        data = await legacy_ai_request("/chat/completions", payload)
        return {
            "recipes": _extract_content(data),
            "ingredients_used": ingredients,
            "dietary_preferences": dietary_preferences,
        }
    except Exception as exc:
        logger.error("get_recipes AI call failed: %s", exc)
        return {"error": f"Failed to generate recipes: {str(exc)}"}


# ---------------------------------------------------------------------------
# get_storage_tips — food storage & preservation advice
# ---------------------------------------------------------------------------

async def _get_storage_tips(
    food_items: list[str] | None = None,
    user_id: str | None = None,
) -> dict:
    """Generate storage tips for specific food items or a user's claimed food."""
    from backend.ai_engine import supabase_get, legacy_ai_request, _extract_content, DEFAULT_MODEL

    logger.info("get_storage_tips: food_items=%s user_id=%s", food_items, user_id)

    # If user_id provided, look up their claimed/listed food
    if not food_items and user_id:
        food_items = []
        try:
            claims = await supabase_get("food_claims", {
                "claimer_id": f"eq.{user_id}",
                "status": "in.(pending,approved)",
                "select": "food_id",
                "limit": "20",
            })
            food_ids = [c["food_id"] for c in claims if c.get("food_id")]
            for fid in food_ids[:10]:
                try:
                    rows = await supabase_get("food_listings", {
                        "id": f"eq.{fid}",
                        "select": "title",
                    })
                    if rows:
                        food_items.append(rows[0].get("title", ""))
                except Exception:
                    pass
        except Exception as exc:
            logger.error("Failed to fetch user claims for storage tips: %s", exc)

    if not food_items:
        return {"error": "No food items provided and no claimed food found for user."}

    prompt = (
        f"Provide storage tips for these food items: {', '.join(food_items)}. "
        "For each item include: optimal temperature, container type, "
        "shelf life (fridge/freezer/pantry), signs of spoilage, "
        "and tips to extend freshness. Return valid JSON."
    )
    payload = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": "You are a food preservation expert."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
        "max_tokens": 1500,
    }

    try:
        data = await legacy_ai_request("/chat/completions", payload)
        return {
            "tips": _extract_content(data),
            "food_items": food_items,
        }
    except Exception as exc:
        logger.error("get_storage_tips AI call failed: %s", exc)
        return {"error": f"Failed to generate storage tips: {str(exc)}"}


# ---------------------------------------------------------------------------
# get_active_communities — local food sharing groups
# ---------------------------------------------------------------------------

async def _get_active_communities(
    user_id: str | None = None,
    max_results: int = 10,
) -> dict:
    """Fetch active food sharing communities, optionally sorted by proximity."""
    from backend.ai_engine import supabase_get

    logger.info("get_active_communities: user_id=%s max=%d", user_id, max_results)

    # Fetch all active communities
    try:
        communities = await supabase_get("communities", {
            "is_active": "eq.true",
            "select": (
                "id,name,location,contact,hours,phone,description,"
                "latitude,longitude,food_given_lb,families_helped,"
                "school_staff_helped,image"
            ),
            "limit": "50",
        })
    except Exception as exc:
        logger.error("Failed to fetch communities: %s", exc)
        return {"error": f"Could not fetch communities: {str(exc)}"}

    if not communities:
        return {"communities": [], "total": 0, "summary": "No active communities found."}

    # If user_id provided, get their location and sort by distance
    user_lat = user_lng = None
    if user_id:
        try:
            rows = await supabase_get("users", {
                "id": f"eq.{user_id}",
                "select": "latitude,longitude",
            })
            if rows and rows[0].get("latitude") and rows[0].get("longitude"):
                user_lat = float(rows[0]["latitude"])
                user_lng = float(rows[0]["longitude"])
        except Exception as exc:
            logger.warning("Could not get user location: %s", exc)

    results = []
    for c in communities:
        entry = {
            "name": c.get("name", ""),
            "address": c.get("location", ""),
            "contact": c.get("contact", ""),
            "phone": c.get("phone", ""),
            "hours": c.get("hours", ""),
            "description": c.get("description", ""),
            "impact": {
                "food_given_lb": c.get("food_given_lb", 0),
                "families_helped": c.get("families_helped", 0),
                "school_staff_helped": c.get("school_staff_helped", 0),
            },
        }

        c_lat = c.get("latitude")
        c_lng = c.get("longitude")
        if user_lat and user_lng and c_lat and c_lng:
            dist = _haversine(user_lat, user_lng, float(c_lat), float(c_lng))
            entry["distance_km"] = round(dist, 1)
            entry["distance_miles"] = round(dist * 0.621371, 1)

        results.append(entry)

    # Sort by distance if available, otherwise by name
    if user_lat:
        results.sort(key=lambda x: x.get("distance_km", 9999))
    else:
        results.sort(key=lambda x: x["name"])

    results = results[:max_results]

    # Build summary
    total_food = sum(r["impact"]["food_given_lb"] for r in results)
    total_families = sum(r["impact"]["families_helped"] for r in results)
    summary = (
        f"Found {len(results)} active food sharing communit{'y' if len(results) == 1 else 'ies'} "
        f"that have collectively distributed {total_food:,} lbs of food "
        f"and helped {total_families:,} families."
    )

    return {
        "communities": results,
        "total": len(results),
        "summary": summary,
    }
