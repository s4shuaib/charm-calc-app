import { Calculator } from "@/components/Calculator";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-8 text-center text-4xl font-bold text-foreground">
          Calculator
        </h1>
        <Calculator />
      </div>
    </div>
  );
};

export default Index;
