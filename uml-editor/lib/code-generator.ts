import type { UMLClass, Association, AssociationClass, DataType, RelationshipType } from "@/types/uml"
import JSZip from 'jszip'

type UMLLikeClass = UMLClass | AssociationClass

// Map UML data types to Java types
const javaTypeMap: Record<DataType, string> = {
  String: "String",
  Integer: "Integer",
  Boolean: "Boolean",
  Double: "Double",
  Long: "Long",
  Date: "java.util.Date",
  LocalDateTime: "java.time.LocalDateTime",
}

// Map UML data types to JPA column types
const jpaTypeMap: Record<DataType, string> = {
  String: "@Column(length = 255)",
  Integer: "@Column",
  Boolean: "@Column",
  Double: "@Column",
  Long: "@Column",
  Date: "@Temporal(TemporalType.DATE)\n    @Column",
  LocalDateTime: "@Column",
}

export interface GeneratedCode {
  entities: { [className: string]: string }
  repositories: { [className: string]: string }
  services: { [className: string]: string }
  controllers: { [className: string]: string }
  flutterModels: { [className: string]: string }
  flutterServices: { [className: string]: string }
  flutterPages: { [className: string]: string }
  flutterForms: { [className: string]: string }
  flutterMain: string
  flutterPubspec: string
  flutterReadme: string
  flutterApp: string
  projectStructure: {
    java: { [filePath: string]: string }
    flutter: { [filePath: string]: string }
    root: { [filePath: string]: string }
  }
}

export function generateSpringBootCode(classes: UMLClass[], associations: Association[]): GeneratedCode {
  const result: GeneratedCode = {
    entities: {},
    repositories: {},
    services: {},
    controllers: {},
    flutterModels: {},
    flutterServices: {},
    flutterPages: {},
    flutterForms: {},
    flutterMain: '',
    flutterPubspec: '',
    flutterReadme: '',
    flutterApp: '',
    projectStructure: {
      java: {},
      flutter: {},
      root: {}
    }
  }

  // Generate code for each class
  classes.forEach((umlClass) => {
    const className = umlClass.name
    const classAssociations = associations.filter(
      (assoc) => assoc.fromClassId === umlClass.id || assoc.toClassId === umlClass.id,
    )

    // Check if this is a parent class (has inheritance relationships where it's the target)
    const isParentClass = associations.some(
      (assoc) => assoc.relationshipType === "inheritance" && assoc.toClassId === umlClass.id
    )

    result.entities[className] = generateEntity(umlClass, classAssociations, classes, associations, isParentClass)
    result.repositories[className] = generateRepository(className)
    result.services[className] = generateService(className)
    result.controllers[className] = generateController(className)
    
    // Generate Flutter code
    result.flutterModels[className] = generateFlutterModel(umlClass)
    result.flutterServices[className] = generateFlutterService(className)
    result.flutterPages[className] = generateFlutterListPage(umlClass)
    result.flutterForms[className] = generateFlutterFormPage(umlClass)
  })

  // Generate code for association classes
  associations.forEach((association) => {
    if (association.associationClass) {
      const className = association.associationClass.name
      result.entities[className] = generateAssociationClassEntity(association.associationClass, association, classes)
      result.repositories[className] = generateRepository(className)
      result.services[className] = generateService(className)
      result.controllers[className] = generateController(className)
      
      // Generate Flutter code for association classes
      result.flutterModels[className] = generateFlutterModel(association.associationClass)
      result.flutterServices[className] = generateFlutterService(className)
      result.flutterPages[className] = generateFlutterListPage(association.associationClass)
      result.flutterForms[className] = generateFlutterFormPage(association.associationClass)
    }
  })

  // Generate Flutter project files
  result.flutterMain = generateFlutterMain(classes)
  result.flutterPubspec = generateFlutterPubspec(classes)
  result.flutterReadme = generateFlutterReadme(classes)
  result.flutterApp = generateFlutterApp(classes)

  // Generate complete project structure
  result.projectStructure = generateProjectStructure(result, classes, associations)

  return result
}

function generateEntity(umlClass: UMLClass, associations: Association[], allClasses: UMLClass[], allAssociations: Association[], isParentClass: boolean = false): string {
  const className = umlClass.name
  const imports = new Set<string>()

  // Add basic JPA imports
  imports.add("import jakarta.persistence.*")
  imports.add("import java.io.Serializable")

  // Add Jackson imports for JSON handling
  imports.add("import com.fasterxml.jackson.annotation.JsonIgnore")

  // Check if we need Date/LocalDateTime imports
  umlClass.attributes.forEach((attr) => {
    if (attr.type === "Date") {
      imports.add("import java.util.Date")
      imports.add("import jakarta.persistence.Temporal")
      imports.add("import jakarta.persistence.TemporalType")
    } else if (attr.type === "LocalDateTime") {
      imports.add("import java.time.LocalDateTime")
    }
  })

  // Add relationship imports
  if (associations.length > 0) {
    imports.add("import java.util.Set")
    imports.add("import java.util.HashSet")
  }

  // Check for inheritance relationships
  const inheritanceRelation = associations.find(
    assoc => assoc.relationshipType === "inheritance" && assoc.fromClassId === umlClass.id
  )
  const isChildClass = !!inheritanceRelation

  // Add inheritance imports if needed
  if (isParentClass) {
    imports.add("import jakarta.persistence.Inheritance")
    imports.add("import jakarta.persistence.InheritanceType")
    imports.add("import jakarta.persistence.DiscriminatorColumn")
    imports.add("import jakarta.persistence.DiscriminatorType")
  }
  
  if (isChildClass) {
    imports.add("import jakarta.persistence.DiscriminatorValue")
  }

  // Add composition cascade imports
  const hasComposition = associations.some(
    assoc => assoc.relationshipType === "composition"
  )
  if (hasComposition) {
    imports.add("import jakarta.persistence.CascadeType")
  }

  let entityCode = `package com.example.demo.entity;\n\n`

  // Add imports
  Array.from(imports)
    .sort()
    .forEach((imp) => {
      entityCode += `${imp};\n`
    })

  entityCode += `\n@Entity\n`
  entityCode += `@Table(name = "${className.toLowerCase()}")\n`
  
  // Add inheritance annotations for parent classes
  if (isParentClass) {
    entityCode += `@Inheritance(strategy = InheritanceType.SINGLE_TABLE)\n`
    entityCode += `@DiscriminatorColumn(name = "dtype", discriminatorType = DiscriminatorType.STRING)\n`
  }
  
  // Add discriminator value for child classes
  if (isChildClass) {
    entityCode += `@DiscriminatorValue("${className.toUpperCase()}")\n`
  }
  
  // Determine class declaration (extends for inheritance)
  let classDeclaration = `public class ${className}`
  if (isChildClass && inheritanceRelation) {
    const parentClass = allClasses.find(c => c.id === inheritanceRelation.toClassId)
    if (parentClass) {
      if (inheritanceRelation.inheritanceType === "implements") {
        classDeclaration += ` implements ${parentClass.name}`
      } else {
        classDeclaration += ` extends ${parentClass.name}`
      }
    }
  } else {
    classDeclaration += ` implements Serializable`
  }
  
  entityCode += `${classDeclaration} {\n\n`

  // Add ID field - Skip for child classes as they inherit it
  if (!isChildClass) {
    entityCode += `    @Id\n`
    entityCode += `    @GeneratedValue(strategy = GenerationType.IDENTITY)\n`
    entityCode += `    private Long id;\n\n`
  }

  // Add attributes
  umlClass.attributes.forEach((attr) => {
    const javaType = javaTypeMap[attr.type]
    const jpaAnnotation = jpaTypeMap[attr.type]

    entityCode += `    ${jpaAnnotation}\n`
    entityCode += `    private ${javaType} ${attr.name};\n\n`
  })

  // Add relationships
  associations.forEach((assoc) => {
    // Skip associations that have association classes - they'll be handled differently
    if (assoc.associationClass) {
      return
    }

    // Skip inheritance relationships - they're handled in class declaration
    if (assoc.relationshipType === "inheritance") {
      return
    }

    const isFromClass = assoc.fromClassId === umlClass.id
    const relatedClassId = isFromClass ? assoc.toClassId : assoc.fromClassId
    const relatedClass = allClasses.find((c) => c.id === relatedClassId)

    if (relatedClass) {
      const relatedClassName = relatedClass.name
      const multiplicity = isFromClass ? assoc.toMultiplicity : assoc.fromMultiplicity
      const otherMultiplicity = isFromClass ? assoc.fromMultiplicity : assoc.toMultiplicity

      // Check if it's a Many-to-Many relationship
      const isManyToMany = (multiplicity === "*" || multiplicity === "1..*" || multiplicity === "0..*") &&
                          (otherMultiplicity === "*" || otherMultiplicity === "1..*" || otherMultiplicity === "0..*")

      // Determine cascade type based on relationship type
      let cascadeOptions = ""
      if (assoc.relationshipType === "composition") {
        cascadeOptions = assoc.cascadeDelete 
          ? ", cascade = CascadeType.ALL, orphanRemoval = true"
          : ", cascade = CascadeType.ALL"
      } else if (assoc.relationshipType === "aggregation") {
        cascadeOptions = ", cascade = {CascadeType.PERSIST, CascadeType.MERGE}"
      }

      if (isManyToMany) {
        // Many-to-Many relationship - Use JsonIgnore on one side to prevent cycles
        entityCode += `    @JsonIgnore\n`
        entityCode += `    @ManyToMany${cascadeOptions ? `(${cascadeOptions.substring(2)})` : ""}\n`
        entityCode += `    @JoinTable(\n`
        entityCode += `        name = "${className.toLowerCase()}_${relatedClassName.toLowerCase()}",\n`
        entityCode += `        joinColumns = @JoinColumn(name = "${className.toLowerCase()}_id"),\n`
        entityCode += `        inverseJoinColumns = @JoinColumn(name = "${relatedClassName.toLowerCase()}_id")\n`
        entityCode += `    )\n`
        entityCode += `    private Set<${relatedClassName}> ${relatedClassName.toLowerCase()}s = new HashSet<>();\n\n`
      } else if (multiplicity === "1" || multiplicity === "0..1") {
        // Many-to-One relationship - Use JsonIgnore to prevent cycles
        const annotation = cascadeOptions ? `@ManyToOne(${cascadeOptions.substring(2)})` : "@ManyToOne"
        entityCode += `    @JsonIgnore\n`
        entityCode += `    ${annotation}\n`
        entityCode += `    @JoinColumn(name = "${relatedClassName.toLowerCase()}_id")\n`
        entityCode += `    private ${relatedClassName} ${relatedClassName.toLowerCase()};\n\n`
      } else {
        // One-to-Many relationship - Keep this side visible for serialization
        const mappedBy = `mappedBy = "${className.toLowerCase()}"`
        const fullAnnotation = cascadeOptions 
          ? `@OneToMany(${mappedBy}${cascadeOptions})`
          : `@OneToMany(${mappedBy}, cascade = CascadeType.ALL)`
        entityCode += `    ${fullAnnotation}\n`
        entityCode += `    private Set<${relatedClassName}> ${relatedClassName.toLowerCase()}s = new HashSet<>();\n\n`
      }
    }
  })

  // Add relationships to association classes
  allAssociations.forEach((assoc) => {
    if (assoc.associationClass && (assoc.fromClassId === umlClass.id || assoc.toClassId === umlClass.id)) {
      const associationClassName = assoc.associationClass.name
      entityCode += `    @JsonIgnore\n`
      entityCode += `    @OneToMany(mappedBy = "${umlClass.id === assoc.fromClassId ? 
        allClasses.find(c => c.id === assoc.fromClassId)?.name.toLowerCase() : 
        allClasses.find(c => c.id === assoc.toClassId)?.name.toLowerCase()}", cascade = CascadeType.ALL)\n`
      entityCode += `    private Set<${associationClassName}> ${associationClassName.toLowerCase()}s = new HashSet<>();\n\n`
    }
  })

  // Add constructors
  entityCode += `    // Constructors\n`
  entityCode += `    public ${className}() {}\n\n`

  // Add getters and setters for ID - Skip for child classes as they inherit it
  entityCode += `    // Getters and Setters\n`
  if (!isChildClass) {
    entityCode += `    public Long getId() {\n        return id;\n    }\n\n`
    entityCode += `    public void setId(Long id) {\n        this.id = id;\n    }\n\n`
  }

  // Add getters and setters for attributes
  umlClass.attributes.forEach((attr) => {
    const javaType = javaTypeMap[attr.type]
    const capitalizedName = attr.name.charAt(0).toUpperCase() + attr.name.slice(1)

    entityCode += `    public ${javaType} get${capitalizedName}() {\n        return ${attr.name};\n    }\n\n`
    entityCode += `    public void set${capitalizedName}(${javaType} ${attr.name}) {\n        this.${attr.name} = ${attr.name};\n    }\n\n`
  })

  entityCode += `}\n`
  return entityCode
}

function generateAssociationClassEntity(associationClass: AssociationClass, association: Association, allClasses: UMLClass[]): string {
  const className = associationClass.name
  const imports = new Set<string>()

  // Add basic JPA imports
  imports.add("import jakarta.persistence.*")
  imports.add("import java.io.Serializable")

  // Check if we need Date/LocalDateTime imports
  associationClass.attributes.forEach((attr) => {
    if (attr.type === "Date") {
      imports.add("import java.util.Date")
      imports.add("import jakarta.persistence.Temporal")
      imports.add("import jakarta.persistence.TemporalType")
    } else if (attr.type === "LocalDateTime") {
      imports.add("import java.time.LocalDateTime")
    }
  })

  let entityCode = `package com.example.demo.entity;\n\n`

  // Add imports
  Array.from(imports)
    .sort()
    .forEach((imp) => {
      entityCode += `${imp};\n`
    })

  entityCode += `\n@Entity\n`
  entityCode += `@Table(name = "${className.toLowerCase()}")\n`
  entityCode += `public class ${className} implements Serializable {\n\n`

  // Add ID field
  entityCode += `    @Id\n`
  entityCode += `    @GeneratedValue(strategy = GenerationType.IDENTITY)\n`
  entityCode += `    private Long id;\n\n`

  // Add foreign key fields for the associated classes
  const fromClass = allClasses.find(c => c.id === association.fromClassId)
  const toClass = allClasses.find(c => c.id === association.toClassId)

  if (fromClass) {
    entityCode += `    @ManyToOne\n`
    entityCode += `    @JoinColumn(name = "${fromClass.name.toLowerCase()}_id")\n`
    entityCode += `    private ${fromClass.name} ${fromClass.name.toLowerCase()};\n\n`
  }

  if (toClass) {
    entityCode += `    @ManyToOne\n`
    entityCode += `    @JoinColumn(name = "${toClass.name.toLowerCase()}_id")\n`
    entityCode += `    private ${toClass.name} ${toClass.name.toLowerCase()};\n\n`
  }

  // Add association class attributes
  associationClass.attributes.forEach((attr) => {
    const javaType = javaTypeMap[attr.type]
    const jpaAnnotation = jpaTypeMap[attr.type]

    entityCode += `    ${jpaAnnotation}\n`
    entityCode += `    private ${javaType} ${attr.name};\n\n`
  })

  // Add constructors
  entityCode += `    // Constructors\n`
  entityCode += `    public ${className}() {}\n\n`

  // Add getters and setters for ID
  entityCode += `    // Getters and Setters\n`
  entityCode += `    public Long getId() {\n        return id;\n    }\n\n`
  entityCode += `    public void setId(Long id) {\n        this.id = id;\n    }\n\n`

  // Add getters and setters for foreign key fields
  if (fromClass) {
    const capitalizedName = fromClass.name.charAt(0).toUpperCase() + fromClass.name.slice(1)
    entityCode += `    public ${fromClass.name} get${capitalizedName}() {\n        return ${fromClass.name.toLowerCase()};\n    }\n\n`
    entityCode += `    public void set${capitalizedName}(${fromClass.name} ${fromClass.name.toLowerCase()}) {\n        this.${fromClass.name.toLowerCase()} = ${fromClass.name.toLowerCase()};\n    }\n\n`
  }

  if (toClass) {
    const capitalizedName = toClass.name.charAt(0).toUpperCase() + toClass.name.slice(1)
    entityCode += `    public ${toClass.name} get${capitalizedName}() {\n        return ${toClass.name.toLowerCase()};\n    }\n\n`
    entityCode += `    public void set${capitalizedName}(${toClass.name} ${toClass.name.toLowerCase()}) {\n        this.${toClass.name.toLowerCase()} = ${toClass.name.toLowerCase()};\n    }\n\n`
  }

  // Add getters and setters for association class attributes
  associationClass.attributes.forEach((attr) => {
    const javaType = javaTypeMap[attr.type]
    const capitalizedName = attr.name.charAt(0).toUpperCase() + attr.name.slice(1)

    entityCode += `    public ${javaType} get${capitalizedName}() {\n        return ${attr.name};\n    }\n\n`
    entityCode += `    public void set${capitalizedName}(${javaType} ${attr.name}) {\n        this.${attr.name} = ${attr.name};\n    }\n\n`
  })

  entityCode += `}\n`
  return entityCode
}

function generateRepository(className: string): string {
  return `package com.example.demo.repository;

import com.example.demo.entity.${className};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ${className}Repository extends JpaRepository<${className}, Long> {
    
    // Custom query methods can be added here
    // Example: List<${className}> findByName(String name);
    
}
`
}

function generateService(className: string): string {
  const lowerClassName = className.toLowerCase()

  return `package com.example.demo.service;

import com.example.demo.entity.${className};
import com.example.demo.repository.${className}Repository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ${className}Service {

    @Autowired
    private ${className}Repository ${lowerClassName}Repository;

    public List<${className}> findAll() {
        return ${lowerClassName}Repository.findAll();
    }

    public Optional<${className}> findById(Long id) {
        return ${lowerClassName}Repository.findById(id);
    }

    public ${className} save(${className} ${lowerClassName}) {
        return ${lowerClassName}Repository.save(${lowerClassName});
    }

    public ${className} update(Long id, ${className} ${lowerClassName}Details) {
        ${className} ${lowerClassName} = ${lowerClassName}Repository.findById(id)
                .orElseThrow(() -> new RuntimeException("${className} not found with id: " + id));
        
        // Update fields here
        // ${lowerClassName}.setField(${lowerClassName}Details.getField());
        
        return ${lowerClassName}Repository.save(${lowerClassName});
    }

    public void deleteById(Long id) {
        ${lowerClassName}Repository.deleteById(id);
    }
}
`
}

function generateController(className: string): string {
  const lowerClassName = className.toLowerCase()

  return `package com.example.demo.controller;

import com.example.demo.entity.${className};
import com.example.demo.service.${className}Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/${lowerClassName}s")
@CrossOrigin(origins = "*")
public class ${className}Controller {

    @Autowired
    private ${className}Service ${lowerClassName}Service;

    @GetMapping
    public List<${className}> getAllItems() {
        return ${lowerClassName}Service.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<${className}> getItemById(@PathVariable Long id) {
        return ${lowerClassName}Service.findById(id)
                .map(item -> ResponseEntity.ok().body(item))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ${className} createItem(@RequestBody ${className} ${lowerClassName}) {
        return ${lowerClassName}Service.save(${lowerClassName});
    }

    @PutMapping("/{id}")
    public ResponseEntity<${className}> updateItem(@PathVariable Long id, @RequestBody ${className} ${lowerClassName}Details) {
        try {
            ${className} updated${className} = ${lowerClassName}Service.update(id, ${lowerClassName}Details);
            return ResponseEntity.ok(updated${className});
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteItem(@PathVariable Long id) {
        ${lowerClassName}Service.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
`
}

function generatePostmanCollection(classes: UMLClass[]): string {
  const collectionId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `postman-${Math.random().toString(16).slice(2)}`

  const headers = [
    {
      key: "Content-Type",
      name: "Content-Type",
      value: "application/json",
      type: "text"
    },
    {
      key: "Accept",
      name: "Accept",
      value: "application/json",
      type: "text"
    }
  ]

  const items = classes.map(umlClass => {
    const className = umlClass.name
    const lowerClassName = className.toLowerCase()
    const endpointBase = `/api/${lowerClassName}s`
    const sampleBody = buildSampleBody(umlClass)

    return {
      name: `${className} CRUD`,
      item: [
        {
          name: `List ${className}`,
          request: {
            method: "GET",
            header: headers.slice(1),
            url: `{{baseUrl}}${endpointBase}`
          },
          response: []
        },
        {
          name: `Get ${className} by ID`,
          request: {
            method: "GET",
            header: headers.slice(1),
            url: `{{baseUrl}}${endpointBase}/{{${lowerClassName}Id}}`
          },
          response: [],
          description: "Reemplaza {{${lowerClassName}Id}} con el identificador real."
        },
        {
          name: `Create ${className}`,
          request: {
            method: "POST",
            header: headers,
            body: {
              mode: "raw",
              raw: JSON.stringify(sampleBody, null, 2),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: `{{baseUrl}}${endpointBase}`
          },
          response: []
        },
        {
          name: `Update ${className}`,
          request: {
            method: "PUT",
            header: headers,
            body: {
              mode: "raw",
              raw: JSON.stringify({ ...sampleBody, id: 1 }, null, 2),
              options: {
                raw: {
                  language: "json"
                }
              }
            },
            url: `{{baseUrl}}${endpointBase}/{{${lowerClassName}Id}}`
          },
          response: [],
          description: "Actualiza el identificador y los campos necesarios antes de enviar."
        },
        {
          name: `Delete ${className}`,
          request: {
            method: "DELETE",
            header: headers.slice(1),
            url: `{{baseUrl}}${endpointBase}/{{${lowerClassName}Id}}`
          },
          response: [],
          description: "Reemplaza {{${lowerClassName}Id}} con el identificador real."
        }
      ]
    }
  })

  const collection = {
    info: {
      _postman_id: collectionId,
      name: "UML Generated Spring Boot API",
      description: "Colección generada automáticamente para probar el backend Spring Boot exportado desde el UML Editor.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: items,
    variable: [
      {
        key: "baseUrl",
        value: "http://localhost:8080",
        type: "string"
      }
    ]
  }

  return JSON.stringify(collection, null, 2)
}

function buildSampleBody(umlClass: UMLClass): Record<string, unknown> {
  const sample: Record<string, unknown> = {}

  if (umlClass.attributes.length === 0) {
    sample["sampleField"] = "valor"
    return sample
  }

  umlClass.attributes.forEach(attr => {
    sample[attr.name] = getSampleValue(attr.type)
  })

  return sample
}

function getSampleValue(type: DataType): unknown {
  switch (type) {
    case "String":
      return "texto-ejemplo"
    case "Integer":
    case "Long":
      return 1
    case "Boolean":
      return true
    case "Double":
      return 1.0
    case "Date":
      return "2024-01-01"
    case "LocalDateTime":
      return "2024-01-01T00:00:00"
    default:
      return null
  }
}

function createLabelFromName(name: string): string {
  if (!name) return ""
  const withSpaces = name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

function getKeyboardTypeForDataType(type: DataType): string {
  switch (type) {
    case "Integer":
    case "Long":
      return "TextInputType.number"
    case "Double":
      return "const TextInputType.numberWithOptions(decimal: true)"
    case "Date":
    case "LocalDateTime":
      return "TextInputType.datetime"
    default:
      return "TextInputType.text"
  }
}

function getValueExpressionForDataType(type: DataType, controllerName: string): string {
  const accessor = `${controllerName}.text`
  switch (type) {
    case "Integer":
    case "Long":
      return `_parseInt(${accessor})`
    case "Double":
      return `_parseDouble(${accessor})`
    case "Boolean":
      return `_parseBool(${accessor})`
    case "Date":
    case "LocalDateTime":
      return `_parseDateTime(${accessor})`
    case "String":
    default:
      return `_parseString(${accessor})`
  }
}

// Flutter Code Generators

// Map UML data types to Dart types
const dartTypeMap: Record<DataType, string> = {
  String: "String",
  Integer: "int",
  Boolean: "bool",
  Double: "double",
  Long: "int",
  Date: "DateTime",
  LocalDateTime: "DateTime",
}

function generateFlutterModel(umlClass: UMLLikeClass): string {
  const className = umlClass.name
  const lowerClassName = className.toLowerCase()

  const attributeFields = umlClass.attributes.map((attr) => {
    const dartType = dartTypeMap[attr.type] || "String"
    return {
      name: attr.name,
      dartType,
    }
  })

  const fieldLines = [
    "  final int? id;",
    ...attributeFields.map((field) => `  final ${field.dartType}? ${field.name};`),
  ].join("\n")

  const constructorParams = [
    "    this.id,",
    ...attributeFields.map((field) => `    this.${field.name},`),
  ].join("\n")

  const toStringBodyParts = [
    "id: \\$id",
    ...attributeFields.map((field) => `${field.name}: \${${field.name}}`),
  ]

  const toStringBody = toStringBodyParts.join(", ")

  return `import 'package:json_annotation/json_annotation.dart';

part '${lowerClassName}.g.dart';

@JsonSerializable(explicitToJson: true)
class ${className} {
${fieldLines}

  const ${className}({
${constructorParams}
  });

  factory ${className}.fromJson(Map<String, dynamic> json) => _$${className}FromJson(json);

  Map<String, dynamic> toJson() => _$${className}ToJson(this);

  @override
  String toString() => '${className}(${toStringBody})';
}
`
}

function generateFlutterService(className: string): string {
  const lowerClassName = className.toLowerCase()
  
  return `import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/${lowerClassName}.dart';

class ${className}Service {
  static const String baseUrl = 'http://localhost:8080/api';
  
  // Get all ${lowerClassName}s
  static Future<List<${className}>> getAll${className}s() async {
    try {
      final response = await http.get(
        Uri.parse('\$baseUrl/${lowerClassName}s'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> jsonList = json.decode(response.body) as List<dynamic>;
        return jsonList.map((json) => ${className}.fromJson(json as Map<String, dynamic>)).toList();
      }
      throw Exception('Failed to load ${lowerClassName}s (status: \${response.statusCode})');
    } catch (e) {
      throw Exception('Error: \$e');
    }
  }
  
  // Get ${lowerClassName} by ID
  static Future<${className}> get${className}ById(int id) async {
    try {
      final response = await http.get(
        Uri.parse('\$baseUrl/${lowerClassName}s/\$id'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body) as Map<String, dynamic>;
        return ${className}.fromJson(data);
      }
      throw Exception('Failed to load ${lowerClassName} (status: \${response.statusCode})');
    } catch (e) {
      throw Exception('Error: \$e');
    }
  }
  
  // Create new ${lowerClassName}
  static Future<${className}> create${className}(${className} ${lowerClassName}) async {
    try {
      final response = await http.post(
        Uri.parse('\$baseUrl/${lowerClassName}s'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(${lowerClassName}.toJson()),
      );
      
      if (response.statusCode == 201 || response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body) as Map<String, dynamic>;
        return ${className}.fromJson(data);
      }
      if (response.statusCode == 204) {
        return ${className}.fromJson(${lowerClassName}.toJson());
      }
      throw Exception('Failed to create ${lowerClassName} (status: \${response.statusCode})');
    } catch (e) {
      throw Exception('Error: \$e');
    }
  }
  
  // Update ${lowerClassName}
  static Future<${className}> update${className}(int id, ${className} ${lowerClassName}) async {
    try {
      final response = await http.put(
        Uri.parse('\$baseUrl/${lowerClassName}s/\$id'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(${lowerClassName}.toJson()),
      );
      
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = json.decode(response.body) as Map<String, dynamic>;
        return ${className}.fromJson(data);
      }
      if (response.statusCode == 204) {
        return ${className}.fromJson(${lowerClassName}.toJson());
      }
      throw Exception('Failed to update ${lowerClassName} (status: \${response.statusCode})');
    } catch (e) {
      throw Exception('Error: \$e');
    }
  }
  
  // Delete ${lowerClassName}
  static Future<void> delete${className}(int id) async {
    try {
      final response = await http.delete(
        Uri.parse('\$baseUrl/${lowerClassName}s/\$id'),
        headers: {'Content-Type': 'application/json'},
      );
      
      if (response.statusCode != 200 && response.statusCode != 204) {
        throw Exception('Failed to delete ${lowerClassName} (status: \${response.statusCode})');
      }
    } catch (e) {
      throw Exception('Error: \$e');
    }
  }
}
`
}

function generateFlutterListPage(umlClass: UMLLikeClass): string {
  const className = umlClass.name
  const lowerClassName = className.toLowerCase()
  
  return `import 'package:flutter/material.dart';
import '../models/${lowerClassName}.dart';
import '../services/${lowerClassName}_service.dart';
import '${lowerClassName}_form_page.dart';

class ${className}ListPage extends StatefulWidget {
  @override
  _${className}ListPageState createState() => _${className}ListPageState();
}

class _${className}ListPageState extends State<${className}ListPage> {
  List<${className}> ${lowerClassName}s = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    _load${className}s();
  }

  Future<void> _load${className}s() async {
    try {
      setState(() {
        isLoading = true;
        errorMessage = null;
      });
      
      final loaded${className}s = await ${className}Service.getAll${className}s();
      setState(() {
        ${lowerClassName}s = loaded${className}s;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = e.toString();
        isLoading = false;
      });
    }
  }

  Future<void> _delete${className}(${className} ${lowerClassName}) async {
    if (${lowerClassName}.id == null) return;
    
    try {
      await ${className}Service.delete${className}(${lowerClassName}.id!);
      _load${className}s(); // Reload the list
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${className} deleted successfully')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error deleting ${lowerClassName}: \$e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${className}s'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
      body: isLoading
          ? Center(child: CircularProgressIndicator())
          : errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error, size: 64, color: Colors.red),
                      SizedBox(height: 16),
                      Text('Error: \$errorMessage'),
                      SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _load${className}s,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : ${lowerClassName}s.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inbox, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text('No ${lowerClassName}s found'),
                          SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () => _navigateToForm(),
                            child: Text('Add First ${className}'),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load${className}s,
                      child: ListView.builder(
                        itemCount: ${lowerClassName}s.length,
                        itemBuilder: (context, index) {
                          final ${lowerClassName} = ${lowerClassName}s[index];
                          return Card(
                            margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            child: ListTile(
                              title: Text(${lowerClassName}.toString()),
                              subtitle: Text('ID: \${${lowerClassName}.id}'),
                              trailing: PopupMenuButton(
                                itemBuilder: (context) => [
                                  PopupMenuItem(
                                    value: 'edit',
                                    child: Row(
                                      children: [
                                        Icon(Icons.edit),
                                        SizedBox(width: 8),
                                        Text('Edit'),
                                      ],
                                    ),
                                  ),
                                  PopupMenuItem(
                                    value: 'delete',
                                    child: Row(
                                      children: [
                                        Icon(Icons.delete, color: Colors.red),
                                        SizedBox(width: 8),
                                        Text('Delete', style: TextStyle(color: Colors.red)),
                                      ],
                                    ),
                                  ),
                                ],
                                onSelected: (value) {
                                  if (value == 'edit') {
                                    _navigateToForm(${lowerClassName});
                                  } else if (value == 'delete') {
                                    _showDeleteDialog(${lowerClassName});
                                  }
                                },
                              ),
                              onTap: () => _navigateToForm(${lowerClassName}),
                            ),
                          );
                        },
                      ),
                    ),
      floatingActionButton: FloatingActionButton(
        onPressed: _navigateToForm,
        child: Icon(Icons.add),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
    );
  }

  void _navigateToForm([${className}? ${lowerClassName}]) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ${className}FormPage(${lowerClassName}: ${lowerClassName}),
      ),
    ).then((_) => _load${className}s());
  }

  void _showDeleteDialog(${className} ${lowerClassName}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete ${className}'),
        content: Text('Are you sure you want to delete this ${lowerClassName}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _delete${className}(${lowerClassName});
            },
            child: Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
`
}

function generateFlutterFormPage(umlClass: UMLLikeClass): string {
  const className = umlClass.name
  const lowerClassName = className.toLowerCase()
  const attributes = umlClass.attributes

  const controllerDeclarations = attributes.length
    ? attributes
        .map((attr) => `  final TextEditingController _${attr.name}Controller = TextEditingController();`)
        .join("\n")
    : ""

  const populateFormLines = attributes.length
    ? attributes
        .map(
          (attr) =>
            `    _${attr.name}Controller.text = ${lowerClassName}.${attr.name}?.toString() ?? '';`,
        )
        .join("\n")
    : "    // No attributes to populate."

  const disposeLines = attributes.length
    ? attributes.map((attr) => `    _${attr.name}Controller.dispose();`).join("\n")
    : ""

  const formFields = attributes.length
    ? attributes
        .map((attr, index) => {
          const label = createLabelFromName(attr.name)
          const keyboardType = getKeyboardTypeForDataType(attr.type)
          const spacer = index < attributes.length - 1 ? "\n              const SizedBox(height: 16),\n" : "\n"
          return `              TextFormField(
                controller: _${attr.name}Controller,
                decoration: const InputDecoration(
                  labelText: '${label}',
                  border: OutlineInputBorder(),
                ),
                keyboardType: ${keyboardType},
              ),${spacer}`
        })
        .join("")
        .trimEnd()
    : "              const Text('No editable attributes defined for this entity.'),"

  const assignmentLines = attributes.length
    ? attributes
        .map(
          (attr) =>
            `      ${attr.name}: ${getValueExpressionForDataType(attr.type, `_${attr.name}Controller`)},`,
        )
        .join("\n")
    : ""

  const createObject = assignmentLines
    ? `    final new${className} = ${className}(
${assignmentLines}
    );`
    : `    final new${className} = const ${className}();`

  const updateAssignments = assignmentLines
    ? `      id: widget.${lowerClassName}!.id,
${assignmentLines}`
    : `      id: widget.${lowerClassName}!.id,`

  const updateObject = `    final updated${className} = ${className}(
${updateAssignments}
    );`

  return `import 'package:flutter/material.dart';
import '../models/${lowerClassName}.dart';
import '../services/${lowerClassName}_service.dart';

class ${className}FormPage extends StatefulWidget {
  const ${className}FormPage({super.key, this.${lowerClassName}});

  final ${className}? ${lowerClassName};

  @override
  State<${className}FormPage> createState() => _${className}FormPageState();
}

class _${className}FormPageState extends State<${className}FormPage> {
  final _formKey = GlobalKey<FormState>();
  bool isLoading = false;
${controllerDeclarations ? `\n${controllerDeclarations}\n` : ""}
  @override
  void initState() {
    super.initState();
    if (widget.${lowerClassName} != null) {
      _populateForm();
    }
  }

  void _populateForm() {
    final ${lowerClassName} = widget.${lowerClassName}!;
${populateFormLines}
  }

  Future<void> _save${className}() async {
    if (!_formKey.currentState!.validate()) return;

    FocusScope.of(context).unfocus();

    setState(() {
      isLoading = true;
    });

    try {
      if (widget.${lowerClassName}?.id != null) {
${updateObject}
        await ${className}Service.update${className}(widget.${lowerClassName}!.id!, updated${className});
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('${className} updated successfully')),
        );
      } else {
${createObject}
        await ${className}Service.create${className}(new${className});
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('${className} created successfully')),
        );
      }

      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving ${lowerClassName}: \$e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.${lowerClassName}?.id != null ? 'Edit ${className}' : 'Add ${className}'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
        actions: [
          if (widget.${lowerClassName}?.id != null)
            IconButton(
              icon: const Icon(Icons.delete),
              onPressed: _showDeleteDialog,
            ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
${formFields}
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: isLoading ? null : _save${className},
                    child: isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : Text(
                            widget.${lowerClassName}?.id != null ? 'Update ${className}' : 'Create ${className}',
                            style: const TextStyle(fontSize: 16),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showDeleteDialog() {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete ${className}'),
        content: Text('Are you sure you want to delete this ${lowerClassName}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                await ${className}Service.delete${className}(widget.${lowerClassName}!.id!);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('${className} deleted successfully')),
                );
                Navigator.pop(context, true);
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Error deleting ${lowerClassName}: \$e')),
                );
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
${disposeLines ? `${disposeLines}\n` : ""}
    super.dispose();
  }

  String? _parseString(String value) {
    final normalized = value.trim();
    return normalized.isEmpty ? null : normalized;
  }

  int? _parseInt(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) return null;
    return int.tryParse(normalized);
  }

  double? _parseDouble(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) return null;
    return double.tryParse(normalized);
  }

  bool? _parseBool(String value) {
    final normalized = value.trim().toLowerCase();
    if (normalized.isEmpty) return null;
    if (normalized == 'true') return true;
    if (normalized == 'false') return false;
    return null;
  }

  DateTime? _parseDateTime(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) return null;
    return DateTime.tryParse(normalized);
  }
}
`
}

// Flutter Project Files Generators

function generateFlutterMain(classes: UMLClass[]): string {
  const imports = classes
    .map((umlClass) => `import 'pages/${umlClass.name.toLowerCase()}_list_page.dart';`)
    .join("\n")

  const moduleEntries = classes
    .map((umlClass) => {
      const name = umlClass.name
      const description = `Manage ${umlClass.name.toLowerCase()}s`
      return `    _Module(
      name: '${name}',
      description: '${description}',
      builder: (context) => ${name}ListPage(),
    ),`
    })
    .join("\n")

  return `import 'package:flutter/material.dart';
${imports ? `${imports}\n` : ""}
void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'UML Generated App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.blue,
          foregroundColor: Colors.white,
        ),
      ),
      home: const HomePage(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  static final List<_Module> _modules = [
${moduleEntries}
  ];

  @override
  Widget build(BuildContext context) {
    final modules = _modules;

    return Scaffold(
      appBar: AppBar(
        title: const Text('UML Generated App'),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              elevation: 3,
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: const [
                    Icon(Icons.account_tree, size: 56, color: Colors.blue),
                    SizedBox(height: 16),
                    Text(
                      'Welcome to your UML Generated App',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Choose one of the generated modules below to manage your data.',
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Available Modules',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: modules.isEmpty
                  ? const Center(
                      child: Text('No modules available. Add classes to your diagram and export again.'),
                    )
                  : ListView.separated(
                      itemCount: modules.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final module = modules[index];
                        return Card(
                          child: ListTile(
                            leading: const CircleAvatar(
                              backgroundColor: Colors.blue,
                              child: Icon(Icons.table_chart, color: Colors.white),
                            ),
                            title: Text(module.name),
                            subtitle: Text(module.description),
                            trailing: const Icon(Icons.arrow_forward_ios),
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: module.builder),
                              );
                            },
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Module {
  const _Module({
    required this.name,
    required this.description,
    required this.builder,
  });

  final String name;
  final String description;
  final WidgetBuilder builder;
}
`
}

function generateFlutterPubspec(classes: UMLClass[]): string {
  return `name: uml_generated_app
description: A Flutter app generated from UML diagram
version: 1.0.0+1

environment:
  sdk: '>=3.8.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  
  # HTTP client for API calls
  http: ^1.1.0
  
  # JSON serialization
  json_annotation: ^4.9.0
  
  # State management
  provider: ^6.1.1
  
  # UI components
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  
  # JSON code generation
  json_serializable: ^6.8.0
  build_runner: ^2.4.7
  
  # Linting
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
  
  # App icon
  # assets:
  #   - images/
`
}

function generateFlutterReadme(classes: UMLClass[]): string {
  const classNames = classes.map(c => c.name).join(', ')
  
  return `# UML Generated Flutter App

This Flutter application was automatically generated from a UML class diagram.

## 📱 Features

- **CRUD Operations**: Complete Create, Read, Update, Delete functionality
- **REST API Integration**: Connects to Spring Boot backend
- **Modern UI**: Material Design with responsive layout
- **Error Handling**: Robust error handling and loading states
- **Navigation**: Intuitive navigation between screens

## 🏗️ Generated Modules

The following modules were generated from your UML diagram:

${classes.map(c => `- **${c.name}**: ${c.attributes.length} attributes`).join('\n')}

## 🚀 Getting Started

### Prerequisites

- Flutter SDK (>=3.8.0)
- Dart SDK (>=3.8.0)
- Android Studio / VS Code
- Spring Boot backend running on http://localhost:8080

### Installation

1. **Clone or download** this generated project
2. **Install dependencies**:
   \`\`\`bash
   flutter pub get
   \`\`\`

3. **(Una sola vez) Genera los proyectos de plataforma**:
   \`\`\`bash
   flutter create .
   \`\`\`

4. **Genera el código JSON**:
   \`\`\`bash
   dart run build_runner build --delete-conflicting-outputs
   \`\`\`

5. **Ejecuta la app**:
   \`\`\`bash
   flutter run
   \`\`\`

## 🔧 Configuration

### Backend URL

Update the base URL in each service file if your backend is running on a different port:

\`\`\`dart
// In lib/services/*_service.dart
static const String baseUrl = 'http://localhost:8080/api';
\`\`\`

### API Endpoints

The app expects the following REST endpoints:

${classes.map(c => `- **${c.name}**: /api/${c.name.toLowerCase()}s`).join('\n')}

## 📁 Project Structure

\`\`\`
lib/
├── models/           # Data models with JSON serialization
├── services/         # HTTP services for API calls
├── pages/            # UI screens (list and form pages)
├── main.dart         # App entry point
└── app.dart          # Main app widget
\`\`\`

## 🎨 UI Features

- **Material Design**: Modern, responsive UI
- **Loading States**: Spinner indicators during API calls
- **Error Handling**: User-friendly error messages
- **Pull to Refresh**: Refresh data by pulling down
- **Floating Action Button**: Quick access to create new items
- **Context Menu**: Edit/Delete options on long press

## 🔄 CRUD Operations

Each module includes:

1. **List Page**: View all items with search and filter
2. **Form Page**: Create and edit items
3. **Service**: HTTP client for API communication
4. **Model**: Data structure with JSON serialization

## 🐛 Troubleshooting

### Common Issues

1. **Build Runner Errors**:
   \`\`\`bash
   flutter clean
   flutter pub get
   dart run build_runner build --delete-conflicting-outputs
   \`\`\`

2. **API Connection Issues**:
   - Check if Spring Boot backend is running
   - Verify the base URL in service files
   - Check network permissions in Android/iOS

3. **JSON Serialization Errors**:
   - Run build_runner after model changes
   - Check model field names match API response

## 📝 Generated by

This app was generated by UML Editor with AI assistance.

**Generated on**: ${new Date().toLocaleDateString()}
**Classes**: ${classNames}
`
}

function generateFlutterApp(classes: UMLClass[]): string {
  return `import 'package:flutter/material.dart';
import 'main.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) => const MyApp();
}
`
}

// Project Structure Generator

function generateProjectStructure(generatedCode: GeneratedCode, classes: UMLClass[], associations: Association[]): {
  java: { [filePath: string]: string }
  flutter: { [filePath: string]: string }
  root: { [filePath: string]: string }
} {
  const javaFiles: { [filePath: string]: string } = {}
  const flutterFiles: { [filePath: string]: string } = {}
  const rootFiles: { [filePath: string]: string } = {}

  // Generate Java Spring Boot structure
  Object.entries(generatedCode.entities).forEach(([className, code]) => {
    javaFiles[`src/main/java/com/example/demo/entity/${className}.java`] = code
  })

  Object.entries(generatedCode.repositories).forEach(([className, code]) => {
    javaFiles[`src/main/java/com/example/demo/repository/${className}Repository.java`] = code
  })

  Object.entries(generatedCode.services).forEach(([className, code]) => {
    javaFiles[`src/main/java/com/example/demo/service/${className}Service.java`] = code
  })

  Object.entries(generatedCode.controllers).forEach(([className, code]) => {
    javaFiles[`src/main/java/com/example/demo/controller/${className}Controller.java`] = code
  })

  // Add Spring Boot configuration files
  javaFiles['pom.xml'] = generateSpringBootPom(classes)
  javaFiles['src/main/resources/application.yml'] = generateSpringBootConfig()
  javaFiles['src/main/java/com/example/demo/DemoApplication.java'] = generateSpringBootMain()
  // Small default endpoints so "/" and "/health" work in browser immediately
  javaFiles['src/main/java/com/example/demo/controller/HomeController.java'] = generateSpringBootHomeController()
  javaFiles['README.md'] = generateSpringBootReadme(classes)

  // Generate Flutter structure
  Object.entries(generatedCode.flutterModels).forEach(([className, code]) => {
    flutterFiles[`lib/models/${className.toLowerCase()}.dart`] = code
  })

  Object.entries(generatedCode.flutterServices).forEach(([className, code]) => {
    flutterFiles[`lib/services/${className.toLowerCase()}_service.dart`] = code
  })

  Object.entries(generatedCode.flutterPages).forEach(([className, code]) => {
    flutterFiles[`lib/pages/${className.toLowerCase()}_list_page.dart`] = code
  })

  Object.entries(generatedCode.flutterForms).forEach(([className, code]) => {
    flutterFiles[`lib/pages/${className.toLowerCase()}_form_page.dart`] = code
  })

  flutterFiles['lib/main.dart'] = generatedCode.flutterMain
  flutterFiles['lib/app.dart'] = generatedCode.flutterApp
  flutterFiles['pubspec.yaml'] = generatedCode.flutterPubspec
  flutterFiles['README.md'] = generatedCode.flutterReadme

  // Generate root project files
  rootFiles['README.md'] = generateRootReadme(classes)
  rootFiles['docker-compose.yml'] = generateDockerCompose()
  // Default env for generated Spring Boot DB (dev/test convenience)
  rootFiles['.env'] = generateSpringBootEnv()
  rootFiles['.gitignore'] = generateGitIgnore()
  rootFiles['postman_collection.json'] = generatePostmanCollection(classes)

  return {
    java: javaFiles,
    flutter: flutterFiles,
    root: rootFiles
  }
}

function generateSpringBootPom(classes: UMLClass[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
        <relativePath/>
    </parent>
    <groupId>com.example</groupId>
    <artifactId>demo</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>demo</name>
    <description>Spring Boot application generated from UML diagram</description>
    <properties>
        <java.version>17</java.version>
    </properties>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <!-- OpenAPI/Swagger UI -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.3.0</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>

</project>
`
}

function generateSpringBootConfig(): string {
  return `spring:
  application:
    name: uml-generated-app
  
  datasource:
    url: jdbc:postgresql://localhost:5432/uml_editor-test
    username: postgres
    password: root
    driver-class-name: org.postgresql.Driver
  
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true
  
  server:
    port: 8080
  
logging:
  level:
    com.example.demo: DEBUG
    org.springframework.web: DEBUG
`
}

function generateSpringBootHomeController(): string {
  return `package com.example.demo.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {

    @GetMapping("/")
    public Map<String, Object> home() {
        return Map.of(
                "status", "ok",
                "message", "UML Generated Spring Boot API is running",
                "docs", "/swagger-ui/index.html",
                "openapi", "/v3/api-docs"
        );
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "healthy");
    }
}
`;
}

function generateSpringBootEnv(): string {
  // Intentionally includes credentials for local testing (user requested).
  return `# Generated Spring Boot DB credentials (local/test)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uml_editor-test
DB_USER=postgres
DB_PASSWORD=root
`
}

function generateSpringBootMain(): string {
  return `package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }

}
`
}

function generateSpringBootReadme(classes: UMLClass[]): string {
  const classNames = classes.map(c => c.name).join(', ')
  
  return `# Spring Boot Backend - UML Generated

This Spring Boot application was automatically generated from a UML class diagram.

## 🚀 Features

- **REST API**: Complete CRUD endpoints for all entities
- **JPA Integration**: Automatic database mapping
- **PostgreSQL**: Production-ready database
- **CORS Enabled**: Ready for Flutter frontend integration

## 🏗️ Generated Entities

The following entities were generated from your UML diagram:

${classes.map(c => `- **${c.name}**: ${c.attributes.length} attributes`).join('\n')}

## 🚀 Getting Started

### Prerequisites

- Java 17+
- Maven 3.6+
- PostgreSQL 12+
- Flutter SDK (for frontend)

### Installation

1. **Clone or download** this project
2. **Install PostgreSQL** and create database:
   \`\`\`sql
   CREATE DATABASE uml_editor-test;
   \`\`\`

3. **Update database configuration** in \`src/main/resources/application.yml\`

4. **Run the application**:
   \`\`\`bash
   mvn spring-boot:run
   \`\`\`

## 🔧 Configuration

### Database Setup

1. **Install PostgreSQL**
2. **Create database**:
   \`\`\`sql
   CREATE DATABASE uml_editor-test;
   CREATE USER postgres WITH PASSWORD 'root';
   GRANT ALL PRIVILEGES ON DATABASE uml_editor-test TO postgres;
   \`\`\`

3. **Update application.yml** with your database credentials

### API Endpoints

The application provides the following REST endpoints:

${classes.map(c => `- **${c.name}**: http://localhost:8080/api/${c.name.toLowerCase()}s`).join('\n')}

## 📁 Project Structure

\`\`\`
src/main/java/com/example/demo/
├── controller/        # REST controllers
├── service/          # Business logic services
├── repository/       # Data access layer
├── entity/           # JPA entities
└── DemoApplication.java
\`\`\`

## 🔄 CRUD Operations

Each entity includes:

1. **Controller**: REST endpoints (GET, POST, PUT, DELETE)
2. **Service**: Business logic layer
3. **Repository**: Data access with Spring Data JPA
4. **Entity**: JPA mapping with relationships

## 🌐 CORS Configuration

The backend is configured to accept requests from Flutter frontend:

- **Allowed Origins**: http://localhost (Flutter default)
- **Allowed Methods**: GET, POST, PUT, DELETE
- **Allowed Headers**: Content-Type, Authorization

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection**:
   - Check PostgreSQL is running
   - Verify database credentials
   - Ensure database exists

2. **Port Conflicts**:
   - Default port: 8080
   - Change in application.yml if needed

3. **CORS Issues**:
   - Check Flutter base URL matches backend
   - Verify CORS configuration

## 📝 Generated by

This backend was generated by UML Editor with AI assistance.

**Generated on**: ${new Date().toLocaleDateString()}
**Classes**: ${classNames}
`
}

function generateJavaOnlyReadme(classes: UMLClass[]): string {
  const classNames = classes.map(c => c.name).join(', ')

  return `# Spring Boot Backend (Solo Backend + Postman)

Este paquete contiene únicamente el backend Spring Boot generado a partir de tu diagrama UML, listo para probarse con Postman.

## ✅ Contenido

- Código Java en \`src/\` (controladores, servicios, entidades, repositorios).
- Archivo \`pom.xml\` con dependencias.
- \`docker-compose.yml\` para iniciar PostgreSQL rápidamente.
- \`postman_collection.json\` con todas las peticiones CRUD.
- \`.gitignore\` sugerido.

## ⚙️ Requisitos

- **Java 17+**
- **Maven 3.6+**
- **PostgreSQL** (local o Docker)
- **Postman**

## 🚀 Puesta en marcha

1. (Opcional) Inicia PostgreSQL con Docker:
   \`\`\`bash
   docker-compose up -d
   \`\`\`
   Esto levanta una base \`uml_editor\` con el usuario/password definidos en \`docker-compose.yml\`.

2. Configura tu entorno si usas otra instancia de PostgreSQL; edita \`src/main/resources/application.yml\`.

3. Compila y ejecuta Spring Boot:
   \`\`\`bash
   mvn clean install
   mvn spring-boot:run
   \`\`\`

4. La API quedará disponible en: **http://localhost:8080/api**

## 🧪 Pruebas con Postman

1. Abre Postman y ve a **File → Import**.
2. Selecciona \`postman_collection.json\`.
3. Asegúrate de que la variable \`baseUrl\` esté configurada en \`http://localhost:8080\`.
4. Para cada entidad se generaron las peticiones:
   - **List** (GET /api/...)
   - **Get by ID** (GET /api/.../{id})
   - **Create** (POST /api/...)
   - **Update** (PUT /api/.../{id})
   - **Delete** (DELETE /api/.../{id})

Ejecuta primero **List** para comprobar la conexión, luego usa **Create** y copia el \`id\` de la respuesta para las operaciones restantes.

## 🧱 Estructura generada

- Entidades: ${classNames || "(sin clases generadas)"}
- Controladores REST y servicios para cada entidad
- Configuración CORS y conexión a PostgreSQL

## ℹ️ Notas

- Puedes modificar libremente el código y volver a exportar tu diagrama para regenerar la estructura.
- Si cambias el esquema de la base de datos, recuerda actualizar \`application.yml\`.

¡Listo! Con esto tienes el backend y la colección de Postman en un solo paquete.`
}

function generateRootReadme(classes: UMLClass[]): string {
  const classNames = classes.map(c => c.name).join(', ')
  
  return `# UML Generated Full-Stack Project

This project contains both **Spring Boot backend** and **Flutter frontend** generated from a UML class diagram.

## 📁 Project Structure

\`\`\`
uml-generated-project/
├── java/                    # Spring Boot Backend
│   ├── src/main/java/       # Java source code
│   ├── src/main/resources/  # Configuration files
│   ├── pom.xml             # Maven dependencies
│   └── README.md           # Backend documentation
├── flutter/                 # Flutter Frontend
│   ├── lib/                # Dart source code
│   ├── pubspec.yaml        # Flutter dependencies
│   └── README.md           # Frontend documentation
├── postman_collection.json  # API tests (Postman)
├── docker-compose.yml      # Database setup
├── .gitignore             # Git ignore rules
└── README.md              # This file
\`\`\`

## 🏗️ Generated Modules

The following modules were generated from your UML diagram:

${classes.map(c => `- **${c.name}**: Complete CRUD in both backend and frontend`).join('\n')}

## 🚀 Quick Start

### 1. Database Setup

\`\`\`bash
# Start PostgreSQL with Docker
docker-compose up -d
\`\`\`

### 2. Backend Setup

\`\`\`bash
cd java
mvn spring-boot:run
\`\`\`

### 3. Frontend Setup

\`\`\`bash
cd flutter
flutter pub get
flutter create .
dart run build_runner build --delete-conflicting-outputs
flutter run
\`\`\`

### 4. API Testing (Postman)

1. Importa \`postman_collection.json\` en Postman.
2. Verifica que el backend esté ejecutándose en \`http://localhost:8080\`.
3. Actualiza la variable \`baseUrl\` si usas otra URL.
4. Ejecuta las solicitudes CRUD para validar la API.

## 🔧 Configuration

### Backend (Spring Boot)
- **Port**: 8080
- **Database**: PostgreSQL (localhost:5432)
- **API Base**: http://localhost:8080/api

### Frontend (Flutter)
- **Backend URL**: http://localhost:8080/api
- **Platform**: Android/iOS/Web

## 📱 Features

### Backend Features
- ✅ **REST API** with complete CRUD operations
- ✅ **JPA Entities** with relationships
- ✅ **PostgreSQL** integration
- ✅ **CORS** enabled for Flutter
- ✅ **Error handling** and validation

### Frontend Features
- ✅ **Material Design** UI
- ✅ **CRUD operations** for all entities
- ✅ **HTTP client** integration
- ✅ **Error handling** and loading states
- ✅ **Navigation** between screens

## 🔄 Data Flow

1. **Flutter** makes HTTP request to Spring Boot
2. **Spring Boot** processes request and queries database
3. **PostgreSQL** returns data to Spring Boot
4. **Spring Boot** sends JSON response to Flutter
5. **Flutter** updates UI with received data

## 🐛 Troubleshooting

### Backend Issues
- Check PostgreSQL is running: \`docker-compose ps\`
- Verify database connection in application.yml
- Check port 8080 is available

### Frontend Issues
- Run \`flutter clean && flutter pub get\`
- Genera el código JSON: \`dart run build_runner build --delete-conflicting-outputs\`
- Check backend URL in service files

### Connection Issues
- Verify backend is running on http://localhost:8080
- Check CORS configuration in Spring Boot
- Ensure Flutter base URL matches backend

## 📝 Generated by

This full-stack project was generated by UML Editor with AI assistance.

**Generated on**: ${new Date().toLocaleDateString()}
**Classes**: ${classNames}
**Stack**: Spring Boot + Flutter + PostgreSQL
`
}

function generateDockerCompose(): string {
  return `version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: uml_postgres
    environment:
      POSTGRES_DB: uml_editor-test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: root
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
`
}

function generateGitIgnore(): string {
  return `# Compiled class file
*.class

# Log file
*.log

# BlueJ files
*.ctxt

# Mobile Tools for Java (J2ME)
.mtj.tmp/

# Package Files #
*.jar
*.war
*.nar
*.ear
*.zip
*.tar.gz
*.rar

# virtual machine crash logs
hs_err_pid*

# Maven
target/
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
pom.xml.next
release.properties
dependency-reduced-pom.xml
buildNumber.properties
.mvn/timing.properties
.mvn/wrapper/maven-wrapper.jar

# Spring Boot
.gradle
build/
!gradle/wrapper/gradle-wrapper.jar
!**/src/main/**/build/
!**/src/test/**/build/

# Flutter
.dart_tool/
.packages
.pub-cache/
.pub/
/build/

# Android related
**/android/**/gradle-wrapper.jar
**/android/.gradle
**/android/captures/
**/android/gradlew
**/android/gradlew.bat
**/android/local.properties
**/android/**/GeneratedPluginRegistrant.java

# iOS/XCode related
**/ios/**/*.mode1v3
**/ios/**/*.mode2v3
**/ios/**/*.moved-aside
**/ios/**/*.pbxuser
**/ios/**/*.perspectivev3
**/ios/**/*sync/
**/ios/**/.sconsign.dblite
**/ios/**/.tags*
**/ios/**/.vagrant/
**/ios/**/DerivedData/
**/ios/**/Icon?
**/ios/**/Pods/
**/ios/**/.symlinks/
**/ios/**/profile
**/ios/**/xcuserdata
**/ios/.generated/
**/ios/Flutter/App.framework
**/ios/Flutter/Flutter.framework
**/ios/Flutter/Flutter.podspec
**/ios/Flutter/Generated.xcconfig
**/ios/Flutter/app.flx
**/ios/Flutter/app.zip
**/ios/Flutter/flutter_assets/
**/ios/Flutter/flutter_export_environment.sh
**/ios/ServiceDefinitions.json
**/ios/Runner/GeneratedPluginRegistrant.*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Database
*.db
*.sqlite
*.sqlite3
`
}

function generateFlutterGitIgnore(): string {
  return `# Miscellaneous
*.class
*.log
*.pyc
*.swp
.DS_Store
.atom/
.buildlog/
.history
.svn/
migrate_working_dir/

# IntelliJ related
*.iml
*.ipr
*.iws
.idea/

# The .vscode folder contains launch configuration and tasks you configure in
# VS Code which you may wish to be included in version control, so this line
# is commented out by default.
#.vscode/

# Flutter/Dart/Pub related
**/doc/api/
**/ios/Flutter/.last_build_id
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
/build/

# Symbolication related
app.*.symbols

# Obfuscation related
app.*.map.json

# Android Studio will place build artifacts here
/android/app/debug
/android/app/profile
/android/app/release

# Generated files
lib/**/*.g.dart
`
}

function generateAnalysisOptions(): string {
  return `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    - avoid_print
    - prefer_const_constructors
    - prefer_const_literals_to_create_immutables
    - prefer_const_declarations
    - avoid_unnecessary_containers
    - sized_box_for_whitespace
`
}

function generateFlutterSetupScript(): string {
  return `#!/bin/bash

echo "🚀 Configurando proyecto Flutter..."

# Verificar Flutter
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter no está instalado. Instálalo desde https://flutter.dev"
    exit 1
fi

echo "✅ Flutter encontrado"

# Crear estructura de plataformas (sin sobrescribir archivos existentes)
echo "📁 Creando estructura de plataformas..."
flutter create . --platforms=android,ios,web 2>/dev/null || echo "⚠️  Algunas plataformas pueden no estar disponibles"

# Instalar dependencias
echo "📦 Instalando dependencias..."
flutter pub get

# Generar código JSON
echo "🔧 Generando código JSON serialization..."
dart run build_runner build --delete-conflicting-outputs

echo ""
echo "✅ ¡Configuración completada!"
echo ""
echo "Para ejecutar la app:"
echo "  flutter run"
echo ""
echo "Para ejecutar en una plataforma específica:"
echo "  flutter run -d chrome    # Web"
echo "  flutter run -d android   # Android"
echo "  flutter run -d ios       # iOS"
`
}

function generateFlutterSetupScriptWindows(): string {
  return `@echo off
echo 🚀 Configurando proyecto Flutter...

REM Verificar Flutter
where flutter >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Flutter no está instalado. Instálalo desde https://flutter.dev
    exit /b 1
)

echo ✅ Flutter encontrado

REM Crear estructura de plataformas
echo 📁 Creando estructura de plataformas...
flutter create . --platforms=android,ios,web 2>nul

REM Instalar dependencias
echo 📦 Instalando dependencias...
flutter pub get

REM Generar código JSON
echo 🔧 Generando código JSON serialization...
dart run build_runner build --delete-conflicting-outputs

echo.
echo ✅ ¡Configuración completada!
echo.
echo Para ejecutar la app:
echo   flutter run
echo.
echo Para ejecutar en una plataforma específica:
echo   flutter run -d chrome    # Web
echo   flutter run -d android   # Android
echo   flutter run -d windows   # Windows
`
}

// Export Functions

export function exportFullStackProject(classes: UMLClass[], associations: Association[]): void {
  const generatedCode = generateSpringBootCode(classes, associations)
  
  // Create ZIP with folder structure
  const zip = new JSZip()
  
  // Add Java files
  Object.entries(generatedCode.projectStructure.java).forEach(([path, content]) => {
    zip.file(`java/${path}`, content)
  })
  
  // Add Flutter files
  Object.entries(generatedCode.projectStructure.flutter).forEach(([path, content]) => {
    zip.file(`flutter/${path}`, content)
  })
  
  // Add root files
  Object.entries(generatedCode.projectStructure.root).forEach(([path, content]) => {
    zip.file(path, content)
  })
  
  // Generate and download ZIP
  zip.generateAsync({type: "blob"}).then((content: Blob) => {
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = 'uml-generated-project.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  })
}

export function exportJavaOnly(classes: UMLClass[], associations: Association[]): void {
  const generatedCode = generateSpringBootCode(classes, associations)
  
  const zip = new JSZip()
  
  // Add only Java files
  Object.entries(generatedCode.projectStructure.java).forEach(([path, content]) => {
    zip.file(path, content)
  })
  
  // Add Java-only README
  zip.file('README.md', generateJavaOnlyReadme(classes))
  
  // Include Postman collection and optional helpers
  const postmanCollection = generatedCode.projectStructure.root['postman_collection.json']
  if (postmanCollection) {
    zip.file('postman_collection.json', postmanCollection)
  }
  const dockerCompose = generatedCode.projectStructure.root['docker-compose.yml']
  if (dockerCompose) {
    zip.file('docker-compose.yml', dockerCompose)
  }
  const gitignore = generatedCode.projectStructure.root['.gitignore']
  if (gitignore) {
    zip.file('.gitignore', gitignore)
  }
  
  zip.generateAsync({type: "blob"}).then((content: Blob) => {
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = 'spring-boot-project.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  })
}

export function exportFlutterOnly(classes: UMLClass[], associations: Association[]): void {
  const generatedCode = generateSpringBootCode(classes, associations)
  
  const zip = new JSZip()
  
  // Add only Flutter files
  Object.entries(generatedCode.projectStructure.flutter).forEach(([path, content]) => {
    zip.file(path, content)
  })
  
  // Add Flutter-specific configuration files
  zip.file('.gitignore', generateFlutterGitIgnore())
  zip.file('analysis_options.yaml', generateAnalysisOptions())
  zip.file('setup.sh', generateFlutterSetupScript())
  zip.file('setup.bat', generateFlutterSetupScriptWindows())
  
  zip.generateAsync({type: "blob"}).then((content: Blob) => {
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = 'flutter-project.zip'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  })
}

export function getExportOptions(): Array<{value: string, label: string, description: string}> {
  return [
    {
      value: 'fullstack',
      label: '🔄 Proyecto Completo',
      description: 'Java Spring Boot + Flutter + PostgreSQL'
    },
    {
      value: 'java',
      label: '☕ Solo Java (Spring Boot)',
      description: 'Backend con REST API y PostgreSQL'
    },
    {
      value: 'flutter',
      label: '📱 Solo Flutter',
      description: 'App móvil con HTTP client'
    }
  ]
}
