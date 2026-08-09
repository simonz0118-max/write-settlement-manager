# V6.5.11 Deployment Regression Test
- ZIP contains no `.git` directory: PASS
- publish.command uses fresh remote clone: PASS
- publish.command syncs release with rsync --delete: PASS
- GitHub push occurs from fresh checkout: PASS
- Cloudflare deploy occurs only after GitHub stage succeeds: PASS
- ASCII command filenames only: PASS
