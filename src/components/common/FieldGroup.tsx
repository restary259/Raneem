import React, { useId } from "react";

interface FieldGroupProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Accessible field wrapper: the visible label is programmatically associated
 * with the first control it wraps (htmlFor/id), and the whole block is exposed
 * as a labelled group so multi-button choice fields are announced correctly.
 */
const FieldGroup = ({ label, children, className }: FieldGroupProps) => {
  const controlId = useId();
  const labelId = `${controlId}-label`;
  let assigned = false;

  const enhanced = React.Children.map(children, (child) => {
    if (!assigned && React.isValidElement(child)) {
      assigned = true;
      const props = child.props as Record<string, unknown>;
      return React.cloneElement(child as React.ReactElement, {
        id: (props.id as string) ?? controlId,
        "aria-labelledby": (props["aria-labelledby"] as string) ?? labelId,
      });
    }
    return child;
  });

  return (
    <div className={`space-y-1.5 ${className ?? ""}`} role="group" aria-labelledby={labelId}>
      <label id={labelId} htmlFor={controlId} className="text-xs font-semibold text-foreground/80">
        {label}
      </label>
      {enhanced}
    </div>
  );
};

export default FieldGroup;
