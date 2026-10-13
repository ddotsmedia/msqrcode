interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  operating_hours?: Record<string, any>;
}

export function buildJsonLd(branch: Branch) {
  const openingHours = Object.entries(branch.operating_hours || {}).map(([day, hours]: [string, any]) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: day,
    opens: hours.open,
    closes: hours.close,
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: branch.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: branch.address,
    },
    ...(branch.phone && { telephone: branch.phone }),
    hasMenu: typeof window !== 'undefined' ? window.location.href : '',
    ...(openingHours.length > 0 && { openingHoursSpecification: openingHours }),
  };
}

export function setPageTitle(branchName: string) {
  document.title = `${branchName} · Milestones Coffee`;
}

export function setMetaDescription(description: string) {
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute('content', description);
  } else {
    const tag = document.createElement('meta');
    tag.name = 'description';
    tag.content = description;
    document.head.appendChild(tag);
  }
}

export function setOgTags(title: string, description: string, image?: string) {
  const tags = [
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...(image ? [{ property: 'og:image', content: image }] : []),
  ];

  tags.forEach(({ property, content }) => {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  });
}
