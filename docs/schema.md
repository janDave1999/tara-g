# Schema

## Schema Basics
[Microdata: How to use Microdata (schema.org)](https://schema.org/docs/gs.html#microdata_how)

## Example

### JSON-LD
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsTeam",
  "name": "San Francisco 49ers",
  "member": {
    "@type": "OrganizationRole",
    "member": {
      "@type": "Person",
      "name": "Joe Montana"
    },
    "startDate": "1979",
    "endDate": "1992",
    "roleName": "Quarterback"
  }
}
</script>
```

### Microdata (HTML)
```html
<div itemscope itemtype="https://schema.org/SportsTeam">
  <span itemprop="name">San Francisco 49ers</span>
  <div itemprop="member" itemscope itemtype="https://schema.org/OrganizationRole">
    <div itemprop="member" itemscope itemtype="https://schema.org/Person">
      <span itemprop="name">Joe Montana</span>
    </div>
    <span itemprop="startDate">1979</span>
    <span itemprop="endDate">1992</span>
    <span itemprop="roleName">Quarterback</span>
  </div>
</div>
```