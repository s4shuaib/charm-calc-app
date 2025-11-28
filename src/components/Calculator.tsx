import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Operator = "+" | "-" | "×" | "÷" | null;

export const Calculator = () => {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".");
    }
  };

  const clear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const performOperation = (nextOperator: Operator) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operator);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const calculate = (firstValue: number, secondValue: number, operator: Operator): number => {
    switch (operator) {
      case "+":
        return firstValue + secondValue;
      case "-":
        return firstValue - secondValue;
      case "×":
        return firstValue * secondValue;
      case "÷":
        return firstValue / secondValue;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operator) {
      const newValue = calculate(previousValue, inputValue, operator);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  };

  const renderButton = (
    label: string,
    onClick: () => void,
    variant: "number" | "operator" | "equals" | "clear" = "number",
    className?: string
  ) => {
    const baseStyles = "h-16 text-xl font-semibold transition-all active:scale-95";
    const variantStyles = {
      number: "bg-calc-button-number hover:bg-calc-button-number/80 text-foreground shadow-[var(--shadow-button)]",
      operator: "bg-calc-button-operator hover:bg-calc-button-operator/80 text-foreground shadow-[var(--shadow-button)]",
      equals: "bg-calc-button-equals hover:bg-calc-button-equals/90 text-primary-foreground shadow-[var(--shadow-button)]",
      clear: "bg-calc-button-clear hover:bg-calc-button-clear/90 text-foreground shadow-[var(--shadow-button)]",
    };

    return (
      <Button
        onClick={onClick}
        className={cn(baseStyles, variantStyles[variant], className)}
      >
        {label}
      </Button>
    );
  };

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-card rounded-2xl shadow-2xl">
      {/* Display */}
      <div className="mb-6 p-6 bg-calc-display rounded-xl shadow-[var(--shadow-display)]">
        <div className="text-right text-5xl font-light text-calc-display-foreground break-all">
          {display}
        </div>
      </div>

      {/* Buttons Grid */}
      <div className="grid grid-cols-4 gap-3">
        {renderButton("C", clear, "clear")}
        {renderButton("÷", () => performOperation("÷"), "operator")}
        {renderButton("×", () => performOperation("×"), "operator")}
        {renderButton("-", () => performOperation("-"), "operator")}

        {renderButton("7", () => inputDigit("7"))}
        {renderButton("8", () => inputDigit("8"))}
        {renderButton("9", () => inputDigit("9"))}
        {renderButton("+", () => performOperation("+"), "operator")}

        {renderButton("4", () => inputDigit("4"))}
        {renderButton("5", () => inputDigit("5"))}
        {renderButton("6", () => inputDigit("6"))}
        {renderButton(".", inputDecimal, "operator")}

        {renderButton("1", () => inputDigit("1"))}
        {renderButton("2", () => inputDigit("2"))}
        {renderButton("3", () => inputDigit("3"))}
        {renderButton("=", handleEquals, "equals", "row-span-2")}

        {renderButton("0", () => inputDigit("0"), "number", "col-span-2")}
      </div>
    </div>
  );
};
