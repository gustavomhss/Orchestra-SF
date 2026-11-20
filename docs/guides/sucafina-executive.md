# Sucafina Executive Dashboard

The native Executive Dashboard shows four people and efficiency measures together: IT users, OPEX cost per user, OPEX plus CAPEX cost per user, and year-to-date attrition.

The authorized dashboard producer supplies these figures for the selected Executive year and month. Cost per user uses the selected year's budget and the original IT-user lookup: an exact entry for the selected month, otherwise the latest preceding entry in that year, otherwise the latest recorded entry. The dashboard does not calculate these financial measures in the browser.

Missing source values remain unavailable. A missing or nonpositive user count cannot produce a cost-per-user value. A recorded zero budget remains zero when a positive user count exists. Attrition uses the original current employee and selected-year departure figures; an absent value or nonpositive denominator remains unavailable.

The four measures share one row on wide desktop screens and two rows on narrower screens. The recorded cost-per-user benchmark remains visible separately, and existing source edit controls still require review and confirmation. Reading or changing the Executive period does not save a source change.
