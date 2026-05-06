type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-7 max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  );
}
