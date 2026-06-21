using Mono.Cecil;
using Mono.Cecil.Cil;

if (args.Length != 2)
{
    Console.Error.WriteLine("Usage: UnityReferencePatcher <UnityEngine.Modules package root> <output directory>");
    return 2;
}

var packageRoot = Path.GetFullPath(args[0]);
var outputDirectory = Path.GetFullPath(args[1]);
var packageLibDirectory = Path.Combine(packageRoot, "lib", "netstandard2.0");
var coreModuleSource = Path.Combine(packageLibDirectory, "UnityEngine.CoreModule.dll");
var inputModuleSource = Path.Combine(packageLibDirectory, "UnityEngine.InputLegacyModule.dll");

if (!File.Exists(coreModuleSource) || !File.Exists(inputModuleSource))
{
    Console.Error.WriteLine($"UnityEngine.Modules compile assets were not found under: {packageLibDirectory}");
    return 1;
}

Directory.CreateDirectory(outputDirectory);
var coreModuleDestination = Path.Combine(outputDirectory, "UnityEngine.CoreModule.dll");
var inputModuleDestination = Path.Combine(outputDirectory, "UnityEngine.InputLegacyModule.dll");

File.Copy(coreModuleSource, coreModuleDestination, overwrite: true);
File.Copy(inputModuleSource, inputModuleDestination, overwrite: true);

using (var assembly = AssemblyDefinition.ReadAssembly(coreModuleDestination))
{
    var monoBehaviour = assembly.MainModule.GetType("UnityEngine.MonoBehaviour")
        ?? throw new InvalidOperationException("UnityEngine.MonoBehaviour was not found in UnityEngine.CoreModule.dll.");
    var hasPointerConstructor = monoBehaviour.Methods.Any(method =>
        method.IsConstructor
        && method.Parameters.Count == 1
        && method.Parameters[0].ParameterType.FullName == typeof(IntPtr).FullName);

    if (!hasPointerConstructor)
    {
        var pointerConstructor = new MethodDefinition(
            ".ctor",
            MethodAttributes.Public
            | MethodAttributes.HideBySig
            | MethodAttributes.SpecialName
            | MethodAttributes.RTSpecialName,
            assembly.MainModule.TypeSystem.Void);
        pointerConstructor.Parameters.Add(new ParameterDefinition(
            "pointer",
            ParameterAttributes.None,
            assembly.MainModule.ImportReference(typeof(IntPtr))));
        pointerConstructor.Body.Instructions.Add(Instruction.Create(OpCodes.Ret));
        monoBehaviour.Methods.Add(pointerConstructor);
    }

    var temporaryPath = coreModuleDestination + ".tmp";
    assembly.Write(temporaryPath);
    File.Move(temporaryPath, coreModuleDestination, overwrite: true);
}

Console.WriteLine($"Prepared Unity compile references: {outputDirectory}");
return 0;
