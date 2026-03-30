import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        outline: "text-foreground",
        success: "border-emerald-200 bg-emerald-100 text-emerald-700",
        failed: "border-red-200 bg-red-100 text-red-700",
        pending: "border-amber-200 bg-amber-100 text-amber-700",
        safe: "border-emerald-200 bg-emerald-100 text-emerald-700",
        unsafe: "border-red-200 bg-red-100 text-red-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return <Comp className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// badgeVariants is exported alongside Badge so consumers can compose styles — co-location is intentional
// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants };
