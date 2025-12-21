import * as path from "path";
import { parseSync } from "@swc/core";
import type {
  ClassDeclaration,
  Decorator,
  Param,
  ImportDeclaration,
} from "@swc/core";

interface ServiceMethod {
  name: string;
  params: MethodParam[];
  returnType: string;
  isAsync: boolean;
  paramSchemas: string[];
  returnSchema?: string;
}

interface MethodParam {
  name: string;
  type: string;
  decorators: string[];
}

interface ServiceInfo {
  className: string;
  methods: ServiceMethod[];
  hasInjectable: boolean;
  importMap: Record<string, string>;
}

export function generateController(
  filePath: string,
  code: string
): string | null {
  const ast = parseSync(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x"),
    decorators: true,
  });

  const serviceInfo = extractServiceInfo(ast);
  if (!serviceInfo || !serviceInfo.hasInjectable) return null;

  return generateControllerCode(serviceInfo, filePath);
}

function extractServiceInfo(ast: any): ServiceInfo | null {
  let serviceClass: ClassDeclaration | null = null;
  let hasInjectable = false;
  const importMap: Record<string, string> = {};

  for (const item of ast.body) {
    if (item.type === "ImportDeclaration") {
      const decl = item as ImportDeclaration;
      const source = decl.source.value;
      decl.specifiers.forEach((spec) => {
        if (
          spec.type === "ImportSpecifier" ||
          spec.type === "ImportDefaultSpecifier" ||
          spec.type === "ImportNamespaceSpecifier"
        ) {
          importMap[spec.local.value] = source;
        }
      });
    }

    if (
      item.type === "ExportDeclaration" &&
      item.declaration.type === "ClassDeclaration"
    ) {
      const classDecl = item.declaration as ClassDeclaration;
      if (hasInjectableDecorator(classDecl.decorators)) {
        serviceClass = classDecl;
        hasInjectable = true;
      }
    }
  }

  if (!serviceClass || !serviceClass.identifier) return null;

  return {
    className: serviceClass.identifier.value,
    methods: extractMethods(serviceClass),
    hasInjectable,
    importMap,
  };
}

function hasInjectableDecorator(decorators?: Decorator[]): boolean {
  return (
    decorators?.some((d) => {
      const expr = d.expression;
      return (
        (expr.type === "Identifier" && expr.value === "Injectable") ||
        (expr.type === "CallExpression" &&
          expr.callee.type === "Identifier" &&
          expr.callee.value === "Injectable")
      );
    }) ?? false
  );
}

function extractMethods(classDecl: ClassDeclaration): ServiceMethod[] {
  const methods: ServiceMethod[] = [];

  for (const member of classDecl.body) {
    if (member.type === "ClassMethod" && member.accessibility === "public") {
      const method = member as any;
      const methodName =
        method.key.type === "Identifier" ? method.key.value : "";
      if (!methodName) continue;

      if (!method.function.async) {
        throw new Error(
          `Server action ${classDecl.identifier.value}.${methodName} must be async.`
        );
      }

      const { paramSchemas, returnSchema } = extractSignature(
        method.function.decorators,
        method.function.params.length
      );

      methods.push({
        name: methodName,
        params: extractMethodParams(method.function.params),
        returnType: extractReturnType(method.function.returnType),
        isAsync: true,
        paramSchemas,
        returnSchema,
      });
    }
  }
  return methods;
}

function extractSignature(
  decorators: Decorator[] | undefined,
  paramCount: number
) {
  if (!decorators) return { paramSchemas: [] };

  for (const decorator of decorators) {
    const expr = decorator.expression;
    if (
      expr.type === "CallExpression" &&
      expr.callee.type === "Identifier" &&
      expr.callee.value === "Signature"
    ) {
      const args = expr.arguments;
      if (args.length === 0) return { paramSchemas: [] };

      const schemaStrings = args.map((arg) =>
        stringifyExpression(arg.expression)
      );

      if (args.length === 1) {
        return { paramSchemas: [], returnSchema: schemaStrings[0] };
      }

      return {
        paramSchemas: schemaStrings.slice(0, -1),
        returnSchema: schemaStrings[schemaStrings.length - 1],
      };
    }
  }
  return { paramSchemas: [] };
}

function stringifyExpression(expr: any): string {
  if (expr.type === "Identifier") return expr.value;
  if (expr.type === "MemberExpression") {
    return `${stringifyExpression(expr.object)}.${expr.property.value || ""}`;
  }
  if (expr.type === "CallExpression") {
    const args = expr.arguments
      .map((a: any) => stringifyExpression(a.expression))
      .join(", ");
    return `${stringifyExpression(expr.callee)}(${args})`;
  }
  return "any";
}

function extractMethodParams(params: Param[]): MethodParam[] {
  return params.map((p) => {
    const pat = (p as any).pat;
    return {
      name: pat.value,
      type: pat.typeAnnotation
        ? stringifyType(pat.typeAnnotation.typeAnnotation)
        : "any",
      decorators: [],
    };
  });
}

function extractReturnType(node: any): string {
  if (!node?.typeAnnotation) return "any";
  const type = node.typeAnnotation;
  if (type.type === "TsTypeReference" && type.typeName.value === "Promise") {
    return stringifyType(type.typeParams?.params[0]);
  }
  return stringifyType(type);
}

function stringifyType(node: any): string {
  if (!node) return "any";
  switch (node.type) {
    case "TsKeywordType":
      return node.kind;
    case "TsTypeReference":
      const base = node.typeName.value;
      const args = node.typeParams
        ? `<${node.typeParams.params.map(stringifyType).join(", ")}>`
        : "";
      return base + args;
    case "TsArrayType":
      return `${stringifyType(node.elemType)}[]`;
    default:
      return "any";
  }
}

function generateControllerCode(
  serviceInfo: ServiceInfo,
  filePath: string
): string {
  const serviceName = serviceInfo.className;
  const controllerName = serviceName.replace(/Service$/, "AutoController");
  const serviceImportPath = `./${path.basename(filePath).replace(/\.ts$/, "")}`;

  const importGroups = new Map<string, Set<string>>();

  const registerIdentifier = (id: string) => {
    const source = serviceInfo.importMap[id] || serviceImportPath;
    if (!importGroups.has(source)) importGroups.set(source, new Set());
    importGroups.get(source)!.add(id);
  };

  serviceInfo.methods.forEach((m) => {
    [...m.paramSchemas, m.returnSchema].filter(Boolean).forEach((s) => {
      const matches = s!.match(/[A-Z][a-zA-Z0-9]*/g); 
      matches?.forEach(registerIdentifier);
      if (s!.includes("z.")) registerIdentifier("z"); 
    });
  });

  let importStrings = `import { Controller, Post, Get, Body } from "@kithinji/orca";\n`;

  importGroups.forEach((ids, source) => {
    const filteredIds = Array.from(ids).filter((id) => id !== serviceName);
    if (filteredIds.length > 0) {
      importStrings += `\nimport { ${filteredIds.join(
        ", "
      )} } from "${source}";`;
    }
  });

  const methods = serviceInfo.methods
    .map((m) => {
      const hasParams = m.params.length > 0;
      const bodyParam = hasParams ? `@Body() body: any` : "";

      let body = "";
      if (hasParams) {
        if (m.paramSchemas.length > 0) {
          body += `    const b = typeof body === 'object' && body !== null ? body : {};\n`;
          m.params.forEach((p, i) => {
            body += `    const ${p.name} = ${m.paramSchemas[i]}.parse(b.${p.name});\n`;
          });
        } else {
          body += `    const { ${m.params
            .map((p) => p.name)
            .join(", ")} } = body;\n`;
        }
      }

      const callArgs = m.params.map((p) => p.name).join(", ");
      const serviceCall = `this.${
        serviceName.charAt(0).toLowerCase() + serviceName.slice(1)
      }.${m.name}(${callArgs})`;

      if (m.returnSchema) {
        body += `    const res = await ${serviceCall};\n    return ${m.returnSchema}.parse(res);`;
      } else {
        body += `    return ${serviceCall};`;
      }

      return `  @${hasParams ? "Post" : "Get"}("${m.name}")\n  async ${
        m.name
      }(${bodyParam}): Promise<${m.returnType}> {\n${body}\n  }`;
    })
    .join("\n\n");

  return `${importStrings}

@Controller("/${serviceName}", {
  providedIn: "root",
})
export class ${controllerName} {
  constructor(private readonly ${
    serviceName.charAt(0).toLowerCase() + serviceName.slice(1)
  }: ${serviceName}) {}

${methods}
}`;
}
