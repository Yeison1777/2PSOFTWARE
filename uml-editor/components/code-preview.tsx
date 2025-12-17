"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Download, Package, Coffee, Smartphone } from "lucide-react"
import { logger } from "@/lib/logger"
import type { GeneratedCode } from "@/lib/code-generator"
import { exportFullStackProject, exportJavaOnly, exportFlutterOnly, getExportOptions } from "@/lib/code-generator"
import { useToast } from "@/hooks/use-toast"
import type { UMLClass, Association } from "@/types/uml"

interface CodePreviewProps {
  generatedCode: GeneratedCode
  classes: UMLClass[]
  associations: Association[]
  onClose: () => void
}

export function CodePreview({ generatedCode, classes, associations, onClose }: CodePreviewProps) {
  const [selectedClass, setSelectedClass] = useState<string>("")
  const [showExportOptions, setShowExportOptions] = useState(false)
  const { toast } = useToast()

  const classNames = Object.keys(generatedCode.entities)

  // Set initial selected class
  if (!selectedClass && classNames.length > 0) {
    setSelectedClass(classNames[0])
  }

  const copyToClipboard = async (code: string, type: string) => {
    try {
      await navigator.clipboard.writeText(code)
      toast({
        title: "Copied to clipboard",
        description: `${type} code copied successfully`,
      })
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy code to clipboard",
        variant: "destructive",
      })
    }
  }

  const handleExportProject = (exportType: string) => {
    try {
      switch (exportType) {
        case 'fullstack':
          exportFullStackProject(classes, associations)
          toast({
            title: "Proyecto completo exportado",
            description: "Descargando Java Spring Boot + Flutter + PostgreSQL",
          })
          break
        case 'java':
          exportJavaOnly(classes, associations)
          toast({
            title: "Proyecto Java exportado",
            description: "Descargando Spring Boot + PostgreSQL",
          })
          break
        case 'flutter':
          exportFlutterOnly(classes, associations)
          toast({
            title: "Proyecto Flutter exportado",
            description: "Descargando app móvil con HTTP client",
          })
          break
      }
      setShowExportOptions(false)
    } catch (error) {
      toast({
        title: "Error de exportación",
        description: "No se pudo generar el proyecto",
        variant: "destructive",
      })
    }
  }

  const downloadAllCode = async () => {
    // Importar JSZip dinámicamente
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    // Crear carpetas para organizar los archivos
    const entityFolder = zip.folder("entity")
    const repositoryFolder = zip.folder("repository")
    const serviceFolder = zip.folder("service")
    const controllerFolder = zip.folder("controller")

    // Añadir archivos Java al ZIP
    Object.entries(generatedCode.entities).forEach(([className]) => {
      // Archivos Entity
      if (entityFolder) {
        entityFolder.file(`${className}.java`, generatedCode.entities[className])
      }
      
      // Archivos Repository
      if (repositoryFolder) {
        repositoryFolder.file(`${className}Repository.java`, generatedCode.repositories[className])
      }
      
      // Archivos Service
      if (serviceFolder) {
        serviceFolder.file(`${className}Service.java`, generatedCode.services[className])
      }
      
      // Archivos Controller
      if (controllerFolder) {
        controllerFolder.file(`${className}Controller.java`, generatedCode.controllers[className])
      }
    })

    // Incluir el archivo demo.zip desde la carpeta public
    try {
      const demoResponse = await fetch('/demo.zip')
      if (demoResponse.ok) {
        const demoBlob = await demoResponse.blob()
        zip.file("demo.zip", demoBlob)
      }
    } catch (error) {
      logger.warn("Could not include demo.zip in the download:", error)
    }

    // Crear script .bat para Windows
    const batScript = `@echo off
echo Setting up Spring Boot project...
echo.

REM Check if demo.zip exists
if not exist "demo.zip" (
    echo Error: demo.zip not found!
    pause
    exit /b 1
)

REM Extract demo.zip
echo Extracting demo.zip...
powershell -Command "Expand-Archive -Path 'demo.zip' -DestinationPath '.' -Force"

REM Check if extraction was successful
if not exist "demo" (
    echo Error: Failed to extract demo.zip!
    pause
    exit /b 1
)

REM Create target directory structure
set TARGET_DIR=demo\\src\\main\\java\\com\\example\\demo
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

REM Move generated folders to target location
echo Moving generated code to Spring Boot project structure...
if exist "entity" (
    echo Moving entity folder...
    move "entity" "%TARGET_DIR%\\"
)
if exist "repository" (
    echo Moving repository folder...
    move "repository" "%TARGET_DIR%\\"
)
if exist "service" (
    echo Moving service folder...
    move "service" "%TARGET_DIR%\\"
)
if exist "controller" (
    echo Moving controller folder...
    move "controller" "%TARGET_DIR%\\"
)

echo.
echo Setup completed successfully!
echo Your Spring Boot project is ready in the 'demo' folder.
echo.
pause`

    // Crear script .sh para Linux/Mac
    const shScript = `#!/bin/bash

echo "Setting up Spring Boot project..."
echo

# Check if demo.zip exists
if [ ! -f "demo.zip" ]; then
    echo "Error: demo.zip not found!"
    exit 1
fi

# Extract demo.zip
echo "Extracting demo.zip..."
unzip -o demo.zip

# Check if extraction was successful
if [ ! -d "demo" ]; then
    echo "Error: Failed to extract demo.zip!"
    exit 1
fi

# Create target directory structure
TARGET_DIR="demo/src/main/java/com/example/demo"
mkdir -p "$TARGET_DIR"

# Move generated folders to target location
echo "Moving generated code to Spring Boot project structure..."

if [ -d "entity" ]; then
    echo "Moving entity folder..."
    mv "entity" "$TARGET_DIR/"
fi

if [ -d "repository" ]; then
    echo "Moving repository folder..."
    mv "repository" "$TARGET_DIR/"
fi

if [ -d "service" ]; then
    echo "Moving service folder..."
    mv "service" "$TARGET_DIR/"
fi

if [ -d "controller" ]; then
    echo "Moving controller folder..."
    mv "controller" "$TARGET_DIR/"
fi

echo
echo "Setup completed successfully!"
echo "Your Spring Boot project is ready in the 'demo' folder."
echo

# Make the script executable for future use
chmod +x setup.sh`

    // Añadir los scripts al ZIP
    zip.file("setup.bat", batScript)
    zip.file("setup.sh", shScript)

    // Crear un archivo README con instrucciones
    const readmeContent = `# Spring Boot Project Setup

This package contains:
- Generated Java files (Entity, Repository, Service, Controller)
- demo.zip: Spring Boot template project
- Setup scripts for automatic integration

## Setup Instructions

### Windows:
1. Extract all files to a folder
2. Run: setup.bat
3. The script will extract demo.zip and move generated files to the correct location

### Linux/Mac:
1. Extract all files to a folder
2. Make setup script executable: chmod +x setup.sh
3. Run: ./setup.sh
4. The script will extract demo.zip and move generated files to the correct location

## Manual Setup (if scripts don't work):
1. Extract demo.zip
2. Navigate to demo/src/main/java/com/example/demo/
3. Copy the entity, repository, service, and controller folders there

## Project Structure After Setup:
\`\`\`
demo/
├── src/
│   └── main/
│       └── java/
│           └── com/
│               └── example/
│                   └── demo/
│                       ├── entity/
│                       ├── repository/
│                       ├── service/
│                       └── controller/
└── ...
\`\`\`

Your Spring Boot application will be ready to run!
`

    zip.file("README.md", readmeContent)

    // Generar el ZIP y descargarlo
    try {
      const content = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(content)
      const a = document.createElement("a")
      a.href = url
      a.download = "spring-boot-generated-code.zip"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Download started",
        description: "Java files and demo ZIP have been downloaded",
      })
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to generate ZIP file",
        variant: "destructive",
      })
    }
  }

  if (classNames.length === 0) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No Classes to Export</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Please create at least one class before generating Spring Boot code.</p>
          <Button onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full overflow-hidden lg:min-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span>Generated Code</span>
            <div className="flex gap-2">
              <Button onClick={() => setShowExportOptions(true)} size="sm" className="w-full sm:w-auto">
                <Package className="w-4 h-4 mr-2" />
                Export Project
              </Button>
              <Button onClick={downloadAllCode} size="sm" variant="outline" className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Download Code
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-4 h-[75vh] min-h-0">
          {/* Class selector */}
          <div className="w-full lg:w-48 lg:border-r lg:pr-4">
            <h4 className="font-medium mb-3">Classes</h4>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:space-y-2">
              {classNames.map((className) => (
                <Button
                  key={className}
                  variant={selectedClass === className ? "default" : "ghost"}
                  size="sm"
                  className="flex-shrink-0 lg:w-full lg:justify-start"
                  onClick={() => setSelectedClass(className)}
                >
                  {className}
                </Button>
              ))}
            </div>
          </div>

          {/* Code tabs */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="entity" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="entity" className="text-xs sm:text-sm">Entity</TabsTrigger>
                <TabsTrigger value="repository" className="text-xs sm:text-sm">Repository</TabsTrigger>
                <TabsTrigger value="service" className="text-xs sm:text-sm">Service</TabsTrigger>
                <TabsTrigger value="controller" className="text-xs sm:text-sm">Controller</TabsTrigger>
              </TabsList>

              <TabsContent value="entity" className="flex-1 mt-4 min-h-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                  <h4 className="font-medium text-sm sm:text-base">{selectedClass}Entity.java</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedCode.entities[selectedClass], "Entity")}
                    className="w-full sm:w-auto"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100%-3rem)] border rounded-lg">
                  <pre className="p-2 sm:p-4 text-xs sm:text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                    {generatedCode.entities[selectedClass]}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="repository" className="flex-1 mt-4 min-h-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                  <h4 className="font-medium text-sm sm:text-base">{selectedClass}Repository.java</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedCode.repositories[selectedClass], "Repository")}
                    className="w-full sm:w-auto"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100%-3rem)] border rounded-lg">
                  <pre className="p-2 sm:p-4 text-xs sm:text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                    {generatedCode.repositories[selectedClass]}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="service" className="flex-1 mt-4 min-h-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                  <h4 className="font-medium text-sm sm:text-base">{selectedClass}Service.java</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedCode.services[selectedClass], "Service")}
                    className="w-full sm:w-auto"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100%-3rem)] border rounded-lg">
                  <pre className="p-2 sm:p-4 text-xs sm:text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                    {generatedCode.services[selectedClass]}
                  </pre>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="controller" className="flex-1 mt-4 min-h-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                  <h4 className="font-medium text-sm sm:text-base">{selectedClass}Controller.java</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedCode.controllers[selectedClass], "Controller")}
                    className="w-full sm:w-auto"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100%-3rem)] border rounded-lg">
                  <pre className="p-2 sm:p-4 text-xs sm:text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                    {generatedCode.controllers[selectedClass]}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>

      {/* Export Options Modal */}
      {showExportOptions && (
        <Dialog open={showExportOptions} onOpenChange={setShowExportOptions}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Export Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose what type of project you want to export:
              </p>
              <div className="space-y-3">
                {getExportOptions().map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => handleExportProject(option.value)}
                    className="w-full justify-start h-auto p-4"
                    variant="outline"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {option.value === 'fullstack' && <Package className="w-5 h-5" />}
                        {option.value === 'java' && <Coffee className="w-5 h-5" />}
                        {option.value === 'flutter' && <Smartphone className="w-5 h-5" />}
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
