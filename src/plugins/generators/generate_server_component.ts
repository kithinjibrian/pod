import { parseSync } from "@swc/core";
import type { ClassDeclaration, Decorator } from "@swc/core";

interface MethodParam {
  name: string;
  type: string;
}

interface ComponentMethod {
  name: string;
  params: MethodParam[];
  returnType: string;
  isAsync: boolean;
}

interface ComponentInfo {
  className: string;
  methods: ComponentMethod[];
}

export function generateServerComponent(
  filePath: string,
  code: string
): string {
  const ast = parseSync(code, {
    syntax: "typescript",
    tsx: filePath.endsWith("x"),
    decorators: true,
  });

  const componentInfo = extractComponentInfo(ast);

  return generateStubCode(componentInfo);
}

function extractComponentInfo(ast: any): ComponentInfo {
  let componentClass: ClassDeclaration | null = null;

  for (const item of ast.body) {
    if (
      item.type === "ExportDeclaration" &&
      item.declaration.type === "ClassDeclaration"
    ) {
      const classDecl = item.declaration as ClassDeclaration;

      if (hasComponentDecorator(classDecl.decorators)) {
        componentClass = classDecl;
        break;
      }
    }
  }

  if (!componentClass || !componentClass.identifier) {
    throw new Error("Component class is undefined");
  }

  const className = componentClass.identifier.value;
  const methods = extractMethods(componentClass);

  return {
    className,
    methods,
  };
}

function hasComponentDecorator(decorators?: Decorator[]): boolean {
  if (!decorators) return false;

  return decorators.some((decorator) => {
    const expr = decorator.expression;

    if (expr.type === "CallExpression") {
      if (
        expr.callee.type === "Identifier" &&
        expr.callee.value === "Component"
      ) {
        return true;
      }
    }

    if (expr.type === "Identifier" && expr.value === "Component") {
      return true;
    }

    return false;
  });
}

function extractMethods(classDecl: ClassDeclaration): ComponentMethod[] {
  const methods: ComponentMethod[] = [];

  for (const member of classDecl.body) {
    if (member.type === "ClassMethod") {
      const method = member as any;

      const methodName =
        method.key.type === "Identifier" ? method.key.value : "";

      if (!methodName) {
        continue;
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

function generateStubCode(componentInfo: ComponentInfo): string {
  const className = componentInfo.className;

  const build = componentInfo.methods.find((p) => p.name == "build");

  if (build == undefined) {
    throw new Error("Component has no build function");
  }

  return `import { 
  Component, 
  Inject, 
  getCurrentInjector, 
  OrcaComponent,
  JSX,
  OSC,
  HttpClient,
} from "@kithinji/orca";

@Component()
export class ${className} extends OrcaComponent {
    props!: any;

    constructor(
      @Inject("OSC_URL", { maybe: true }) private oscUrl?: string,
      private readonly http: HttpClient,
    ) {
      super();

      if(this.oscUrl === undefined) {
        throw new Error("Server component requires osc url be defined");
      }  
    }

    build() {
        const root = document.createElement("div");
        root.textContent = "loading...";

        const injector = getCurrentInjector();

        if(injector == null) {
          throw new Error("Injector is null");
        }

        const osc = new OSC(root);

        const subscription = this.http.post<JSX.Element>(
          \`\${this.oscUrl}?c=${className}\`, {
            body: this.props
          }
        ).subscribe((jsx: JSX.Element) => {
          const action = jsx.action || "insert";

          if (action === "insert") {
            osc.handleInsert(jsx);
          } else if (action === "update") {
            osc.handleUpdate(jsx);
          } else {
            console.warn(\`Unknown action: \${action}\`);
          }
        });

        this.pushDrop(() => subscription.unsubscribe());

        return root;
    }
}`;
}
