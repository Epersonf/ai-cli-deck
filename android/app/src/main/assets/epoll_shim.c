// LD_PRELOAD shim: proot sometimes makes epoll_pwait fail with an errno other than EINTR,
// which trips `assert(errno == EINTR)` in libuv (uv__io_poll) and aborts node.
// Here those spurious errors become EINTR (libuv simply retries).
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/epoll.h>

// Only node needs this shim: drop it from the environment so the shells and CLIs that node
// starts do not inherit LD_PRELOAD.
__attribute__((constructor)) static void shim_init(void) { unsetenv("LD_PRELOAD"); }

typedef int (*pwait_fn)(int, struct epoll_event *, int, int, const sigset_t *);
static __thread int streak;

int epoll_pwait(int epfd, struct epoll_event *ev, int max, int timeout, const sigset_t *sm) {
  static pwait_fn real;
  if (!real) real = (pwait_fn)dlsym(RTLD_NEXT, "epoll_pwait");
  int r = real(epfd, ev, max, timeout, sm);
  if (r >= 0) { streak = 0; return r; }
  int e = errno;
  if (e == EINTR || e == EBADF || e == EINVAL || streak > 1000) return r;
  streak++;
  char buf[160];
  int n = snprintf(buf, sizeof buf, "[epoll-shim] %ld epoll_pwait errno=%d (%s) -> EINTR\n",
                   (long)time(NULL), e, strerror(e));
  int fd = open("/root/stable-shim.log", O_WRONLY | O_APPEND | O_CREAT | O_CLOEXEC, 0644);
  if (fd >= 0) { if (write(fd, buf, n) < 0) {} close(fd); }
  errno = EINTR;
  return -1;
}
