import { parseSync } from "@swc/core";
import type { ClassDeclaration, Decorator } from "@swc/core";

interface ServiceMethod {
  name: string;
  params: MethodParam[];
  returnType: string;
  isAsync: boolean;
}

interface MethodParam {
  name: string;
  type: string;
}

interface ServiceInfo {
  className: string;
  methods: ServiceMethod[];
}

export function generateRscStub(filePath: string, code: string): string {
  const ast = parseSync(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x"),
    decorators: true,
  });

  const serviceInfo = extractServiceInfo(ast);

  return generateStubCode(serviceInfo);
}

function extractServiceInfo(ast: any): ServiceInfo {
  let serviceClass: ClassDeclaration | null = null;

  for (const item of ast.body) {
    if (
      item.type === "ExportDeclaration" &&
      item.declaration.type === "ClassDeclaration"
    ) {
      const classDecl = item.declaration as ClassDeclaration;

      if (hasInjectableDecorator(classDecl.decorators)) {
        serviceClass = classDecl;
        break;
      }
    }
  }

  if (!serviceClass || !serviceClass.identifier) {
    throw new Error("Service class is undefined");
  }

  const className = serviceClass.identifier.value;
  const methods = extractMethods(serviceClass);

  return {
    className,
    methods,
  };
}

function hasInjectableDecorator(decorators?: Decorator[]): boolean {
  if (!decorators) return false;

  return decorators.some((decorator) => {
    const expr = decorator.expression;

    if (expr.type === "CallExpression") {
      if (
        expr.callee.type === "Identifier" &&
        expr.callee.value === "Injectable"
      ) {
        return true;
      }
    }

    if (expr.type === "Identifier" && expr.value === "Injectable") {
      return true;
    }

    return false;
  });
}

function extractMethods(classDecl: ClassDeclaration): ServiceMethod[] {
  const methods: ServiceMethod[] = [];

  for (const member of classDecl.body) {
    if (member.type === "ClassMethod" && member.accessibility === "public") {
      const method = member as any;

      const methodName =
        method.key.type === "Identifier" ? method.key.value : "";

      if (!methodName) {
        continue;
      }

      if (!method.function.async) {
        throw new Error(
          `Server action ${classDecl.identifier.value}.${methodName} must be async.`
        );
      }

      const params = extractMethodParams(method.function.params || []);
      const returnType = extractReturnType(method.function.returnType);
      const isAsync = method.function.async || false;

      methods.push({
        name: methodName,
        params,
        returnType,
        isAsync,
      });
    }
  }

  return methods;
}

function extractMethodParams(params: any[]): MethodParam[] {
  const result: MethodParam[] = [];

  for (const param of params) {
    if (param.type === "Parameter") {
      const pat = param.pat as any;

      if (pat.type === "Identifier") {
        const name = pat.value;
        const type = pat.typeAnnotation?.typeAnnotation
          ? stringifyType(pat.typeAnnotation.typeAnnotation)
          : "any";

        result.push({
          name,
          type,
        });
      }
    }
  }

  return result;
}

function extractReturnType(returnType?: any): string {
  if (!returnType || !returnType.typeAnnotation) {
    return "any";
  }

  const type = returnType.typeAnnotation;

  if (type.type === "TsTypeReference") {
    const typeName = type.typeName;
    if (typeName.type === "Identifier" && typeName.value === "Promise") {
      if (type.typeParams && type.typeParams.params.length > 0) {
        return stringifyType(type.typeParams.params[0]);
      }
    }
  }

  return stringifyType(type);
}

function stringifyType(typeNode: any): string {
  if (!typeNode) return "any";

  switch (typeNode.type) {
    case "TsKeywordType":
      return typeNode.kind;

    case "TsTypeReference":
      if (typeNode.typeName.type === "Identifier") {
        const baseName = typeNode.typeName.value;
        if (typeNode.typeParams && typeNode.typeParams.params.length > 0) {
          const params = typeNode.typeParams.params
            .map(stringifyType)
            .join(", ");
          return `${baseName}<${params}>`;
        }
        return baseName;
      }
      return "any";

    case "TsArrayType":
      return `${stringifyType(typeNode.elemType)}[]`;

    case "TsUnionType":
      return typeNode.types.map(stringifyType).join(" | ");

    case "TsIntersectionType":
      return typeNode.types.map(stringifyType).join(" & ");

    case "TsTypeLiteral":
      const props = typeNode.members
        .map((member: any) => {
          if (member.type === "TsPropertySignature") {
            const key =
              member.key.type === "Identifier" ? member.key.value : "";
            const type = member.typeAnnotation
              ? stringifyType(member.typeAnnotation.typeAnnotation)
              : "any";
            return `${key}: ${type}`;
          }
          return "";
        })
        .filter(Boolean);
      return `{ ${props.join("; ")} }`;

    default:
      return "any";
  }
}

function generateStubCode(serviceInfo: ServiceInfo): string {
  const className = serviceInfo.className;

  const methods = serviceInfo.methods
    .map((method) => {
      const params = method.params
        .map((p) => `${p.name}: ${p.type}`)
        .join(", ");
      const paramNames = method.params.map((p) => p.name).join(", ");

      const asyncKeyword = method.isAsync ? "async " : "";
      const returnType = method.isAsync
        ? `Promise<${method.returnType}>`
        : method.returnType;

      const hasParams = method.params.length > 0;
      const bodyParam = hasParams ? `{ ${paramNames} }` : "{}";

      if (!hasParams) {
        return `  ${asyncKeyword}${method.name}(${params}): ${returnType} {
    const response = await fetch(\`/${className}/${method.name}\`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }`;
      }

      return `  ${asyncKeyword}${method.name}(${params}): ${returnType} {
    const response = await fetch(\`/${className}/${method.name}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(${bodyParam}),
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return response.json();
  }`;
    })
    .join("\n\n");

  return `import { Injectable } from "@kithinji/orca";

@Injectable()
export class ${className} {
${methods}
}`;
}
