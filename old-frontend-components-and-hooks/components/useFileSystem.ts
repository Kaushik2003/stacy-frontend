import { useFileSystemContext, FileSystemItem } from "./FileSystemContext";

export type { FileSystemItem };

export function useFileSystem() {
    return useFileSystemContext();
}
