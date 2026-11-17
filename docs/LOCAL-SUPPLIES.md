# Local household and worker supplies

Homes consume one food per resident per game day and one wood per occupied
home per day for heating. Wood is firewood directly; no new processing building
is required. Homes replenish small buffers from the nearest reachable stocked
warehouse or marketplace. This is a stock transfer, **not a truck journey**.
Markets can stock firewood as well as food and tools. Local market sales still
earn gold. Food in homes, shops and warehouses contributes to town totals.

Production workers and builders need one tool each for full productivity.
Missing tools reduce productive work to 50%; partial equipment interpolates
between 50% and 100%. Walking speed is unchanged. Tools wear only while doing
work, at one tool per four full worker-days. Workplaces receive real tool
deliveries, reserve their own equipment, and refill with one spare when short.
Construction and road crews also receive the productivity modifier.

Warehouses retain all goods. **No automatic exports or export revenue.** Old
export statistics and income entries remain readable for save compatibility,
but no new exports occur. Warehouse upgrades increase local delivery loads
from 12 to 16 to 20 goods instead of offering an export price bonus.

Food/firewood/tool shortages appear in the building's Needs & stock rows and
colored badges with corrective guidance. Sustained shortages and recovery go
into the town log; normal short gaps do not spam it. Tools appear in the top
resource bar, with total stock and an equipment/delivery breakdown.

Existing towns migrate once: stored goods are distributed without creating
stock or resetting buildings. Fresh towns start with 80 warehouse tools to
cover the starter workforce. Food, heating, tool wear and migration state save
and reload. Household consumption, retained tool deliveries, conservation,
market/warehouse collection, shortages, recovery and traffic have regressions.
