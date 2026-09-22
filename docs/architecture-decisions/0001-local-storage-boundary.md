# ADR 0001: Native IndexedDB behind repositories

Status: accepted.

Use native IndexedDB for all domain entities. A shared implementation supplies
transaction mechanics, while one named repository per entity is the public
boundary. Physical keys combine the percent-encoded account and record IDs, so
neither component can be confused with the other, and every list operation uses
the account index. A repository may purge records in the same transaction as a
write to enforce a retention policy. This minimizes dependencies, establishes
migrations, and prevents feature code from bypassing account isolation. Small
browser storage remains reserved for future needs and is not used by features
now.
